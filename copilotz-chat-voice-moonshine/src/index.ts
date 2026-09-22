import type {
  AudioAttachment,
  CreateVoiceProvider,
  VoiceProvider,
  VoiceProviderHandlers,
  VoiceProviderOptions,
} from '@copilotz/chat-ui';

export interface MoonshineVoiceProviderConfig {
  modelUrl?: string;
  precision?: string;
  verboseLogging?: boolean;
  audioConstraints?: MediaTrackConstraints;
}

const DEFAULT_MODEL_URL = 'model/tiny';

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

const formatFileName = (extension: string): string =>
  `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;

const audioBufferToWavBlob = (audioBuffer: AudioBuffer): Blob => {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const dataLength = audioBuffer.length * numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  const channelData = Array.from(
    { length: numberOfChannels },
    (_, channelIndex) => audioBuffer.getChannelData(channelIndex),
  );

  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channelIndex][sampleIndex]));
      const pcmValue = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcmValue, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const audioBufferToAttachment = async (audioBuffer: AudioBuffer): Promise<AudioAttachment> => {
  const blob = audioBufferToWavBlob(audioBuffer);
  const dataUrl = await blobToDataUrl(blob);

  return {
    kind: 'audio',
    dataUrl,
    mimeType: blob.type,
    durationMs: Math.round(audioBuffer.duration * 1000),
    fileName: formatFileName('wav'),
    size: blob.size,
  };
};

const blobToAttachment = async (blob: Blob, durationMs?: number): Promise<AudioAttachment> => ({
  kind: 'audio',
  dataUrl: await blobToDataUrl(blob),
  mimeType: blob.type || 'audio/webm',
  durationMs,
  fileName: formatFileName(blob.type.includes('ogg') ? 'ogg' : 'webm'),
  size: blob.size,
});

export const createMoonshineVoiceProvider = (
  config: MoonshineVoiceProviderConfig = {},
): CreateVoiceProvider => async (
  handlers: VoiceProviderHandlers,
  options: VoiceProviderOptions = {},
): Promise<VoiceProvider> => {
  let moonshineModule: typeof import('@moonshine-ai/moonshine-js') | null = null;
  let transcriber: import('@moonshine-ai/moonshine-js').Transcriber | null = null;
  let mediaStream: MediaStream | null = null;
  type RecorderCapture = {
    recorder: MediaRecorder;
    stopPromise: Promise<Blob | null>;
  };
  let recorderCapture: RecorderCapture | null = null;
  let durationTimer: ReturnType<typeof setInterval> | null = null;
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let segmentStartedAt = 0;
  let shouldStayArmed = true;
  let isFinalizingManualStop = false;
  let ignoreCommittedSegments = false;
  let isSpeechActive = false;
  let currentDurationMs = 0;
  let lifecycleGeneration = 0;
  let isStarting = false;
  let segmentGeneration = 0;
  let provider: VoiceProvider;

  const clearDurationTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }

    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  };

  const stopOwnedStream = (stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop());
  };

  const releaseStream = (stream: MediaStream | null = mediaStream) => {
    if (!stream) {
      return;
    }

    stopOwnedStream(stream);
    if (mediaStream === stream) {
      mediaStream = null;
    }
  };

  const resetLiveState = () => {
    isSpeechActive = false;
    currentDurationMs = 0;
    segmentStartedAt = 0;
    handlers.onAudioLevelChange?.(0);
  };

  const stopRecorder = (
    capture: RecorderCapture | null = recorderCapture,
  ): Promise<Blob | null> => {
    if (!capture || capture.recorder.state === 'inactive') {
      return capture?.stopPromise ?? Promise.resolve(null);
    }

    capture.recorder.stop();
    return capture.stopPromise;
  };

  const startRecorder = (
    generation: number,
    stream: MediaStream | null = mediaStream,
  ) => {
    if (!stream || typeof MediaRecorder === 'undefined') {
      return;
    }

    const chunks: BlobPart[] = [];
    let resolveStop: ((blob: Blob | null) => void) | null = null;
    const stopPromise = new Promise<Blob | null>((resolve) => {
      resolveStop = resolve;
    });

    const capture: RecorderCapture = { recorder: new MediaRecorder(stream), stopPromise };
    const recorder = capture.recorder;
    recorderCapture = capture;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      if (recorderCapture?.recorder === recorder && generation === lifecycleGeneration) {
        handlers.onError?.(normalizeError(event.error));
      }
    };

    recorder.onstop = () => {
      const blob = chunks.length > 0
        ? new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        })
        : null;

      resolveStop?.(blob);
      if (recorderCapture === capture) {
        recorderCapture = null;
      }
    };

    recorder.start();
  };

  const ensureModule = async () => {
    if (!moonshineModule) {
      moonshineModule = await import('@moonshine-ai/moonshine-js');
      moonshineModule.Settings.VERBOSE_LOGGING = config.verboseLogging ?? false;
    }

    return moonshineModule;
  };

  const cleanupSegmentCapture = () => {
    clearDurationTimer();
    resetLiveState();
  };

  const isCurrentSession = (
    generation: number,
    instance: import('@moonshine-ai/moonshine-js').Transcriber,
  ): boolean => (
    generation === lifecycleGeneration &&
    transcriber === instance
  );

  const stopSession = async (
    instance: import('@moonshine-ai/moonshine-js').Transcriber | null = transcriber,
    stream: MediaStream | null = mediaStream,
    capture: RecorderCapture | null = recorderCapture,
  ) => {
    const ownsLiveState = stream === mediaStream && capture === recorderCapture;
    if (ownsLiveState) {
      clearDurationTimer();
      handlers.onAudioLevelChange?.(0);
      resetLiveState();
    }
    instance?.stop();
    releaseStream(stream);
    await stopRecorder(capture);
  };

  const emitSegment = async (
    generation: number,
    instance: import('@moonshine-ai/moonshine-js').Transcriber,
    attachment: AudioAttachment,
    captureGeneration: number,
    transcriptText?: string,
  ) => {
    if (!isCurrentSession(generation, instance)) {
      return;
    }

    const segmentDurationMs = attachment.durationMs ?? currentDurationMs;
    const isCurrentCapture = captureGeneration === segmentGeneration;
    const shouldResumeListening = isCurrentCapture && shouldStayArmed && !isSpeechActive;
    if (isCurrentCapture) {
      cleanupSegmentCapture();
      handlers.onDurationChange?.(segmentDurationMs);
      handlers.onTranscriptChange?.(transcriptText ? { final: transcriptText } : {});
    }
    handlers.onSegmentReady?.({
      attachment,
      transcript: transcriptText ? { final: transcriptText } : undefined,
      metadata: {
        source: transcriptText ? 'moonshine' : 'moonshine-manual-stop',
        model: config.modelUrl ?? DEFAULT_MODEL_URL,
        segmentCount: 1,
      },
    });

    if (shouldResumeListening) {
      handlers.onStateChange?.('waiting_for_speech');
    }
  };

  const createTranscriber = (
    moonshine: typeof import('@moonshine-ai/moonshine-js'),
    generation: number,
  ): import('@moonshine-ai/moonshine-js').Transcriber => {
    let instance: import('@moonshine-ai/moonshine-js').Transcriber | null = null;
    const callbacks: import('@moonshine-ai/moonshine-js').TranscriberCallbacks = {
      onModelLoadStarted() {
        if (instance && isCurrentSession(generation, instance)) {
          handlers.onStateChange?.('preparing');
        }
      },
      onModelLoaded() {
        if (instance && isCurrentSession(generation, instance) && !isFinalizingManualStop) {
          handlers.onStateChange?.('waiting_for_speech');
        }
      },
      onTranscribeStarted() {
        if (instance && isCurrentSession(generation, instance) && !isFinalizingManualStop) {
          handlers.onStateChange?.('waiting_for_speech');
        }
      },
      onTranscribeStopped() {
        if (instance && isCurrentSession(generation, instance)) {
          handlers.onAudioLevelChange?.(0);
          if (!isFinalizingManualStop) {
            handlers.onStateChange?.('idle');
          }
        }
      },
      onFrame(_probs, frame) {
        if (instance && isCurrentSession(generation, instance) && isSpeechActive) {
          handlers.onAudioLevelChange?.(computeLevelFromFrame(frame));
        }
      },
      onSpeechStart() {
        if (!instance || !isCurrentSession(generation, instance) || isFinalizingManualStop) {
          return;
        }

        ignoreCommittedSegments = false;
        segmentGeneration += 1;
        isSpeechActive = true;
        currentDurationMs = 0;
        segmentStartedAt = Date.now();
        handlers.onTranscriptChange?.({});
        handlers.onDurationChange?.(0);
        handlers.onStateChange?.('listening');
        startRecorder(generation);
        clearDurationTimer();
        durationTimer = setInterval(() => {
          if (!instance || !isCurrentSession(generation, instance)) {
            return;
          }
          currentDurationMs = Math.max(0, Date.now() - segmentStartedAt);
          handlers.onDurationChange?.(currentDurationMs);
        }, 200);
        if (options.maxRecordingMs && options.maxRecordingMs > 0) {
          maxDurationTimer = setTimeout(() => {
            if (generation === lifecycleGeneration) {
              void provider.stop();
            }
          }, options.maxRecordingMs);
        }
      },
      onSpeechEnd() {
        if (!instance || !isCurrentSession(generation, instance) || isFinalizingManualStop) {
          return;
        }

        const capture = recorderCapture;
        isSpeechActive = false;
        clearDurationTimer();
        handlers.onStateChange?.('finishing');
        void stopRecorder(capture);
      },
      onTranscriptionCommitted(text, buffer) {
        if (
          !instance ||
          !isCurrentSession(generation, instance) ||
          ignoreCommittedSegments ||
          isSpeechActive
        ) {
          return;
        }

        const captureGeneration = segmentGeneration;
        void (async () => {
          try {
            const attachment = buffer
              ? await audioBufferToAttachment(buffer)
              : (() => {
                throw new Error('Moonshine did not return audio for the committed segment');
              })();

            if (instance && isCurrentSession(generation, instance)) {
              await emitSegment(
                generation,
                instance,
                attachment,
                captureGeneration,
                text,
              );
            }
          } catch (error) {
            if (instance && isCurrentSession(generation, instance)) {
              handlers.onError?.(normalizeError(error));
            }
          }
        })();
      },
      onError(error) {
        if (instance && isCurrentSession(generation, instance)) {
          handlers.onError?.(normalizeError(error));
        }
      },
    };

    instance = new moonshine.Transcriber(
      config.modelUrl ?? DEFAULT_MODEL_URL,
      callbacks,
      true,
      config.precision ?? 'quantized',
    );
    return instance;
  };

  provider = {
    start: async () => {
      if (isStarting || transcriber?.isActive || mediaStream) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio capture is not supported in this browser');
      }

      shouldStayArmed = true;
      isFinalizingManualStop = false;
      ignoreCommittedSegments = false;
      const generation = ++lifecycleGeneration;
      isStarting = true;
      resetLiveState();
      handlers.onTranscriptChange?.({});
      handlers.onDurationChange?.(0);
      handlers.onStateChange?.('preparing');

      let stream: MediaStream | null = null;
      try {
        const moonshine = await ensureModule();
        if (generation !== lifecycleGeneration) {
          return;
        }

        const instance = createTranscriber(moonshine, generation);
        transcriber = instance;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            sampleRate: 16000,
            ...config.audioConstraints,
          },
        });

        if (generation !== lifecycleGeneration) {
          releaseStream(stream);
          return;
        }

        mediaStream = stream;
        instance.attachStream(stream);
        await instance.start();

        if (!isCurrentSession(generation, instance)) {
          await stopSession(instance, stream, null);
        }
      } catch (error) {
        if (generation !== lifecycleGeneration) {
          return;
        }

        const instance = transcriber;
        transcriber = null;
        await stopSession(instance, stream, recorderCapture);
        throw normalizeError(error);
      } finally {
        if (generation === lifecycleGeneration) {
          isStarting = false;
        }
      }
    },
    stop: async () => {
      if (isStarting) {
        const startedStream = mediaStream;
        const startedCapture = recorderCapture;
        const generation = ++lifecycleGeneration;
        isStarting = false;
        shouldStayArmed = false;
        const instance = transcriber;
        transcriber = null;
        await stopSession(instance, startedStream, startedCapture);
        if (generation !== lifecycleGeneration) {
          return;
        }
        handlers.onStateChange?.('idle');
        return;
      }

      shouldStayArmed = false;
      const generation = lifecycleGeneration;
      const instance = transcriber;
      if (!instance) {
        resetLiveState();
        handlers.onStateChange?.('idle');
        return;
      }
      const wasSpeechActive = isSpeechActive;
      const segmentDurationMs = currentDurationMs;
      const segmentCapture = recorderCapture;
      const segmentStream = mediaStream;
      const captureGeneration = segmentGeneration;
      ignoreCommittedSegments = wasSpeechActive;
      isFinalizingManualStop = wasSpeechActive;
      handlers.onStateChange?.('finishing');
      clearDurationTimer();
      handlers.onAudioLevelChange?.(0);
      isSpeechActive = false;
      instance?.stop();
      releaseStream(segmentStream);

      const blob = await stopRecorder(segmentCapture);
      if (generation === lifecycleGeneration) {
        isFinalizingManualStop = false;
      }

      if (!instance || !isCurrentSession(generation, instance) || !wasSpeechActive || !blob) {
        return;
      }

      await emitSegment(
        generation,
        instance,
        await blobToAttachment(blob, segmentDurationMs || undefined),
        captureGeneration,
      );
    },
    cancel: async () => {
      shouldStayArmed = false;
      ignoreCommittedSegments = true;
      const generation = ++lifecycleGeneration;
      isStarting = false;
      const instance = transcriber;
      const stream = mediaStream;
      const capture = recorderCapture;
      transcriber = null;
      await stopSession(instance, stream, capture);
      if (generation !== lifecycleGeneration) {
        return;
      }
      handlers.onStateChange?.('idle');
      resetLiveState();
    },
    destroy: async () => {
      shouldStayArmed = false;
      ignoreCommittedSegments = true;
      const generation = ++lifecycleGeneration;
      isStarting = false;
      const instance = transcriber;
      const stream = mediaStream;
      const capture = recorderCapture;
      transcriber = null;
      await stopSession(instance, stream, capture);
      if (generation !== lifecycleGeneration) {
        return;
      }
      handlers.onStateChange?.('idle');
      resetLiveState();
    },
  };

  return provider;
};

export type { CreateVoiceProvider };
