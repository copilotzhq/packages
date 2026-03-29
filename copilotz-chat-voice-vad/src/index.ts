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
  let ignoreNextSpeechEnd = false;

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

  const emitDuration = () => {
    if (!segmentStartedAt) {
      handlers.onDurationChange?.(0);
      return;
    }

    handlers.onDurationChange?.(Math.max(0, Date.now() - segmentStartedAt));
  };

  const ensureVad = async () => {
    if (vad) {
      return vad;
    }

    const module = await ensureVadModule();
    const onnxWasmBasePath = await ensureOrtWasmBasePath();

    vad = await module.MicVAD.new({
      model,
      startOnLoad: false,
      submitUserSpeechOnPause: config.submitUserSpeechOnPause ?? true,
      baseAssetPath: vadAssetBasePath,
      onnxWASMBasePath: onnxWasmBasePath,
      getStream: () => navigator.mediaDevices.getUserMedia({ audio: audioConstraints }),
      resumeStream: () => navigator.mediaDevices.getUserMedia({ audio: audioConstraints }),
      onFrameProcessed(_probabilities, frame) {
        if (isSpeechActive) {
          handlers.onAudioLevelChange?.(computeLevelFromFrame(frame));
        }
      },
      onSpeechStart() {
        if (ignoreNextSpeechEnd) {
          ignoreNextSpeechEnd = false;
        }

        isSpeechActive = true;
        segmentStartedAt = Date.now();
        handlers.onDurationChange?.(0);
        handlers.onStateChange?.('listening');
        emitDuration();
        clearTimers();
        durationTimer = setInterval(emitDuration, 200);

        if (options.maxRecordingMs && options.maxRecordingMs > 0) {
          maxDurationTimer = setTimeout(() => {
            void provider.stop();
          }, options.maxRecordingMs);
        }
      },
      onSpeechEnd(audio) {
        const shouldIgnoreSegment = ignoreNextSpeechEnd;
        ignoreNextSpeechEnd = false;

        resetLiveIndicators();

        if (shouldIgnoreSegment) {
          resolveIdleState();
          return;
        }

        handlers.onStateChange?.('finishing');

        void (async () => {
          try {
            const module = await ensureVadModule();
            const attachment = await audioToAttachment(module, audio, sampleRate);

            handlers.onDurationChange?.(attachment.durationMs ?? 0);
            handlers.onSegmentReady?.({
              attachment,
              metadata: {
                source: 'vad',
                model,
                segmentCount: 1,
              },
            });

            handlers.onStateChange?.(shouldStayArmed ? 'waiting_for_speech' : 'review');
          } catch (error) {
            handlers.onError?.(normalizeError(error));
          }
        })();
      },
      onVADMisfire() {
        resetLiveIndicators();
        resolveIdleState();
      },
    });

    return vad;
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
      shouldStayArmed = true;
      ignoreNextSpeechEnd = false;
      resetLiveIndicators();
      handlers.onTranscriptChange?.({});
      handlers.onDurationChange?.(0);
      handlers.onStateChange?.('preparing');

      try {
        const instance = await ensureVad();
        await instance.start();
        handlers.onStateChange?.('waiting_for_speech');
      } catch (error) {
        resetLiveIndicators();
        throw normalizeError(error);
      } finally {
        isStarting = false;
      }
    },
    stop: async () => {
      shouldStayArmed = false;

      if (!vad) {
        handlers.onStateChange?.('idle');
        return;
      }

      handlers.onStateChange?.('finishing');

      const wasSpeechActive = isSpeechActive;
      await vad.pause();

      if (!wasSpeechActive) {
        resetLiveIndicators();
        handlers.onStateChange?.('idle');
      }
    },
    cancel: async () => {
      shouldStayArmed = false;

      if (!vad) {
        resetLiveIndicators();
        handlers.onStateChange?.('idle');
        return;
      }

      const wasSpeechActive = isSpeechActive;
      ignoreNextSpeechEnd = wasSpeechActive;
      await vad.pause();

      if (!wasSpeechActive) {
        ignoreNextSpeechEnd = false;
      }

      resetLiveIndicators();
      handlers.onStateChange?.('idle');
    },
    destroy: async () => {
      shouldStayArmed = false;
      ignoreNextSpeechEnd = true;
      resetLiveIndicators();

      if (!vad) {
        handlers.onStateChange?.('idle');
        return;
      }

      await vad.destroy();
      vad = null;
      ignoreNextSpeechEnd = false;
      handlers.onStateChange?.('idle');
    },
  };

  return provider;
};

export type { CreateVoiceProvider };
