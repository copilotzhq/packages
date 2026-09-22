import type {
  AudioAttachment,
  CreateVoiceProvider,
  VoiceProvider,
  VoiceProviderHandlers,
  VoiceProviderOptions,
} from '@copilotz/chat-ui';

const DEFAULT_VAD_ASSET_BASE_PATH = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/';
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_MODEL = 'legacy';

type VadModule = typeof import('@ricky0123/vad-web');
type OrtWasmModule = typeof import('onnxruntime-web/wasm');

export interface VadVoiceProviderConfig {
  vadAssetBasePath?: string;
  onnxWasmBasePath?: string;
  sampleRate?: number;
  model?: 'legacy' | 'v5';
  audioConstraints?: MediaTrackConstraints;
  submitUserSpeechOnPause?: boolean;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read recorded audio'));
    reader.readAsDataURL(blob);
  });

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return new Error(error);
  }

  return new Error('Unable to capture audio.');
};

const computeLevelFromFrame = (frame: Float32Array): number => {
  if (frame.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < frame.length; index += 1) {
    sum += frame[index] * frame[index];
  }

  return Math.min(1, Math.sqrt(sum / frame.length) * 4);
};

const formatFileName = (): string =>
  `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;

const buildAudioConstraints = (
  sampleRate: number,
  audioConstraints?: MediaTrackConstraints,
): MediaTrackConstraints => ({
  channelCount: 1,
  echoCancellation: true,
  autoGainControl: true,
  noiseSuppression: true,
  sampleRate,
  ...audioConstraints,
});

const audioToAttachment = async (
  vadModule: VadModule,
  audio: Float32Array,
  sampleRate: number,
): Promise<AudioAttachment> => {
  const wavBuffer = vadModule.utils.encodeWAV(audio, 1, sampleRate, 1, 16);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const durationMs = Math.round((audio.length / sampleRate) * 1000);

  return {
    kind: 'audio',
    dataUrl: await blobToDataUrl(blob),
    mimeType: blob.type,
    durationMs,
    fileName: formatFileName(),
    size: blob.size,
  };
};

export const createVadVoiceProvider = (
  config: VadVoiceProviderConfig = {},
): CreateVoiceProvider => async (
  handlers: VoiceProviderHandlers,
  options: VoiceProviderOptions = {},
): Promise<VoiceProvider> => {
  const sampleRate = config.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const model = config.model ?? DEFAULT_MODEL;
  const audioConstraints = buildAudioConstraints(sampleRate, config.audioConstraints);
  const vadAssetBasePath = config.vadAssetBasePath ?? DEFAULT_VAD_ASSET_BASE_PATH;

  let vadModule: VadModule | null = null;
  let ortWasmModule: OrtWasmModule | null = null;
  let vad: import('@ricky0123/vad-web').MicVAD | null = null;
  let durationTimer: ReturnType<typeof setInterval> | null = null;
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let segmentStartedAt = 0;
  let isSpeechActive = false;
  let isStarting = false;
  let shouldStayArmed = true;
  let lifecycleGeneration = 0;
  let vadGeneration = 0;
  let pendingSegmentCount = 0;
  let segmentEndQueued = false;
  const vadStarts = new WeakMap<object, Promise<void>>();
  const vadDisposals = new WeakMap<object, Promise<void>>();
  const streamsByGeneration = new Map<number, Set<MediaStream>>();

  const stopStream = (stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop());
  };

  const releaseStreams = (generation: number) => {
    const streams = streamsByGeneration.get(generation);
    if (!streams) {
      return;
    }

    streamsByGeneration.delete(generation);
    streams.forEach(stopStream);
  };

  const requestStream = (generation: number): Promise<MediaStream> => {
    const request = navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

    return request.then(
      (stream) => {
        if (generation !== lifecycleGeneration) {
          stopStream(stream);
          throw new Error('Audio capture was cancelled.');
        }
        const streams = streamsByGeneration.get(generation) ?? new Set<MediaStream>();
        streams.add(stream);
        streamsByGeneration.set(generation, streams);
        return stream;
      },
    );
  };

  const clearTimers = () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }

    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  };

  const resetLiveIndicators = () => {
    clearTimers();
    segmentStartedAt = 0;
    isSpeechActive = false;
    handlers.onAudioLevelChange?.(0);
  };

  const ensureVadModule = async (): Promise<VadModule> => {
    if (!vadModule) {
      vadModule = await import('@ricky0123/vad-web');
    }

    return vadModule;
  };

  const ensureOrtWasmBasePath = async (): Promise<string> => {
    if (config.onnxWasmBasePath) {
      return config.onnxWasmBasePath;
    }

    if (!ortWasmModule) {
      ortWasmModule = await import('onnxruntime-web/wasm');
    }

    const ortVersion = ortWasmModule.env?.versions?.web;
    if (typeof ortVersion !== 'string' || ortVersion.trim().length === 0) {
      throw new Error('Unable to determine the ONNX runtime version for VAD assets.');
    }

    return `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/`;
  };

  const resolveIdleState = () => {
    handlers.onStateChange?.(shouldStayArmed ? 'waiting_for_speech' : 'idle');
  };

  const isCurrentGeneration = (generation: number): boolean =>
    generation === lifecycleGeneration;

  const emitDuration = (generation: number) => {
    if (!isCurrentGeneration(generation)) {
      return;
    }

    if (!segmentStartedAt) {
      handlers.onDurationChange?.(0);
      return;
    }

    handlers.onDurationChange?.(Math.max(0, Date.now() - segmentStartedAt));
  };

  const ensureVad = async (generation: number) => {
    if (vad) {
      return vad;
    }

    // Acquire permission before loading the model. This keeps a denied or
    // cancelled request from leaving a loaded model with no MicVAD owner.
    const initialStream = await requestStream(generation);
    let initialStreamConsumed = false;
    let instance: import('@ricky0123/vad-web').MicVAD | null = null;

    try {
      const module = await ensureVadModule();
      const onnxWasmBasePath = await ensureOrtWasmBasePath();

      const isCurrentInstance = (): boolean =>
        instance !== null && vad === instance && isCurrentGeneration(vadGeneration) && vadGeneration > 0;

      instance = await module.MicVAD.new({
        model,
        // MicVAD.destroy() requires a fully initialized audio graph. Starting
        // during construction makes the completed instance disposable even
        // when cancellation races model loading.
        startOnLoad: true,
        submitUserSpeechOnPause: config.submitUserSpeechOnPause ?? true,
        baseAssetPath: vadAssetBasePath,
        onnxWASMBasePath: onnxWasmBasePath,
        getStream: () => {
          if (initialStreamConsumed) {
            return requestStream(generation);
          }
          initialStreamConsumed = true;
          return Promise.resolve(initialStream);
        },
        resumeStream: () => requestStream(vadGeneration),
        onFrameProcessed(_probabilities, frame) {
          if (isCurrentInstance() && isSpeechActive) {
            handlers.onAudioLevelChange?.(computeLevelFromFrame(frame));
          }
        },
        onSpeechStart() {
          if (!isCurrentInstance()) {
            return;
          }

          segmentEndQueued = false;
          const speechGeneration = lifecycleGeneration;
          isSpeechActive = true;
          segmentStartedAt = Date.now();
          handlers.onDurationChange?.(0);
          handlers.onStateChange?.('listening');
          emitDuration(speechGeneration);
          clearTimers();
          durationTimer = setInterval(() => emitDuration(speechGeneration), 200);

          if (options.maxRecordingMs && options.maxRecordingMs > 0) {
            maxDurationTimer = setTimeout(() => {
              if (speechGeneration === lifecycleGeneration) {
                void provider.stop();
              }
            }, options.maxRecordingMs);
          }
        },
        onSpeechEnd(audio) {
          if (!isCurrentInstance() || segmentEndQueued || !isSpeechActive) {
            return;
          }

          segmentEndQueued = true;
          isSpeechActive = false;
          pendingSegmentCount += 1;
          const generation = lifecycleGeneration;
          resetLiveIndicators();
          handlers.onStateChange?.('finishing');

          void (async () => {
            try {
              const module = await ensureVadModule();
              const attachment = await audioToAttachment(module, audio, sampleRate);

              if (!isCurrentGeneration(generation) || !isCurrentInstance()) {
                return;
              }

              handlers.onDurationChange?.(attachment.durationMs ?? 0);
              handlers.onSegmentReady?.({
                attachment,
                metadata: {
                  source: 'vad',
                  model,
                  segmentCount: 1,
                },
              });

              if (!isSpeechActive) {
                handlers.onStateChange?.(shouldStayArmed ? 'waiting_for_speech' : 'review');
              }
            } catch (error) {
              if (isCurrentGeneration(generation) && isCurrentInstance()) {
                handlers.onError?.(normalizeError(error));
              }
            } finally {
              if (generation === lifecycleGeneration) {
                pendingSegmentCount = Math.max(0, pendingSegmentCount - 1);
              }
            }
          })();
        },
        onVADMisfire() {
          if (!isCurrentInstance()) {
            return;
          }

          resetLiveIndicators();
          if (pendingSegmentCount === 0) {
            resolveIdleState();
          }
        },
      });
      // startOnLoad resolves only after MicVAD has a complete audio graph.
    } catch (error) {
      releaseStreams(generation);
      throw error;
    }

    if (generation !== lifecycleGeneration) {
      return instance;
    }

    vad = instance;
    return instance;
  };

  const discardVad = async (
    instance: import('@ricky0123/vad-web').MicVAD | null,
    generation: number,
  ) => {
    if (!instance) {
      return;
    }

    const existingDisposal = vadDisposals.get(instance);
    if (existingDisposal) {
      await existingDisposal;
      return;
    }

    const disposal = (async () => {
      const start = vadStarts.get(instance);
      if (start) {
        try {
          await start;
        } catch {
          // The initial start is completed by MicVAD.new({ startOnLoad: true }),
          // so a failed resume still leaves a safe-to-destroy audio graph.
          releaseStreams(generation);
        }
      }

      if (vad === instance) {
        vad = null;
        vadGeneration = 0;
      }

      releaseStreams(generation);
      await instance.destroy();
    })();
    vadDisposals.set(instance, disposal);
    await disposal;
  };

  const startVad = (
    instance: import('@ricky0123/vad-web').MicVAD,
  ): Promise<void> => {
    const promise = instance.start();
    vadStarts.set(instance, promise);
    return promise;
  };

  const provider: VoiceProvider = {
    start: async () => {
      if (isStarting) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio capture is not supported in this browser');
      }

      isStarting = true;
      const generation = ++lifecycleGeneration;
      vadGeneration = 0;
      pendingSegmentCount = 0;
      shouldStayArmed = true;
      segmentEndQueued = false;
      resetLiveIndicators();
      handlers.onTranscriptChange?.({});
      handlers.onDurationChange?.(0);
      handlers.onStateChange?.('preparing');

      try {
        const instance = await ensureVad(generation);
        if (!isCurrentGeneration(generation)) {
          await discardVad(instance, generation);
          return;
        }

        vadGeneration = generation;
        await startVad(instance);

        if (!isCurrentGeneration(generation)) {
          await discardVad(instance, generation);
          return;
        }

        handlers.onStateChange?.('waiting_for_speech');
      } catch (error) {
        if (isCurrentGeneration(generation)) {
          resetLiveIndicators();
        }

        if (!isCurrentGeneration(generation)) {
          return;
        }

        throw normalizeError(error);
      } finally {
        if (generation === lifecycleGeneration) {
          isStarting = false;
        }
      }
    },
    stop: async () => {
      shouldStayArmed = false;

      if (isStarting) {
        const startedGeneration = lifecycleGeneration;
        const generation = ++lifecycleGeneration;
        vadGeneration = 0;
        isStarting = false;
        pendingSegmentCount = 0;
        const instance = vad;
        vad = null;
        resetLiveIndicators();
        releaseStreams(startedGeneration);
        await discardVad(instance, startedGeneration);
        if (generation !== lifecycleGeneration) {
          return;
        }
        handlers.onStateChange?.('idle');
        return;
      }

      const generation = lifecycleGeneration;
      const instance = vad;
      if (!instance) {
        handlers.onStateChange?.('idle');
        return;
      }

      handlers.onStateChange?.('finishing');

      const wasSpeechActive = isSpeechActive;
      await instance.pause();
      releaseStreams(generation);

      if (
        generation === lifecycleGeneration &&
        vad === instance &&
        !wasSpeechActive &&
        pendingSegmentCount === 0
      ) {
        resetLiveIndicators();
        handlers.onStateChange?.('idle');
      }
    },
    cancel: async () => {
      shouldStayArmed = false;
      const startedGeneration = lifecycleGeneration;
      const generation = ++lifecycleGeneration;
      vadGeneration = 0;
      isStarting = false;
      pendingSegmentCount = 0;
      const instance = vad;
      vad = null;
      resetLiveIndicators();
      releaseStreams(startedGeneration);
      await discardVad(instance, startedGeneration);
      if (generation !== lifecycleGeneration) {
        return;
      }
      handlers.onStateChange?.('idle');
    },
    destroy: async () => {
      shouldStayArmed = false;
      const startedGeneration = lifecycleGeneration;
      lifecycleGeneration += 1;
      vadGeneration = 0;
      isStarting = false;
      const generation = lifecycleGeneration;
      pendingSegmentCount = 0;
      const instance = vad;
      vad = null;
      resetLiveIndicators();
      releaseStreams(startedGeneration);
      await discardVad(instance, startedGeneration);
      if (generation !== lifecycleGeneration) {
        return;
      }
      handlers.onStateChange?.('idle');
    },
  };

  return provider;
};

export type { CreateVoiceProvider };
