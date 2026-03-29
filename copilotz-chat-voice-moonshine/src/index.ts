import type {
  AudioAttachment,
  CreateVoiceProvider,
  VoiceProvider,
  VoiceProviderHandlers,
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
): Promise<VoiceProvider> => {
  let moonshineModule: typeof import('@moonshine-ai/moonshine-js') | null = null;
  let transcriber: import('@moonshine-ai/moonshine-js').Transcriber | null = null;
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let recorderStopPromise: Promise<Blob | null> | null = null;
  let recorderStopResolver: ((blob: Blob | null) => void) | null = null;
  let recorderChunks: BlobPart[] = [];
  let durationTimer: ReturnType<typeof setInterval> | null = null;
  let segmentStartedAt = 0;
  let isCancelling = false;
  let didEmitSegment = false;
  let isSpeechActive = false;
  let currentDurationMs = 0;

  const clearDurationTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
  };

  const releaseStream = () => {
    if (!mediaStream) {
      return;
    }

    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  };

  const resetSegmentFlags = () => {
    didEmitSegment = false;
    isSpeechActive = false;
    currentDurationMs = 0;
    segmentStartedAt = 0;
    handlers.onAudioLevelChange?.(0);
  };

  const stopRecorder = (): Promise<Blob | null> => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return recorderStopPromise ?? Promise.resolve(null);
    }

    mediaRecorder.stop();
    return recorderStopPromise ?? Promise.resolve(null);
  };

  const startRecorder = () => {
    if (!mediaStream || typeof MediaRecorder === 'undefined') {
      return;
    }

    recorderChunks = [];
    recorderStopPromise = new Promise<Blob | null>((resolve) => {
      recorderStopResolver = resolve;
    });

    mediaRecorder = new MediaRecorder(mediaStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recorderChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      handlers.onError?.(normalizeError(event.error));
    };

    mediaRecorder.onstop = () => {
      const blob = recorderChunks.length > 0
        ? new Blob(recorderChunks, {
          type: mediaRecorder?.mimeType || 'audio/webm',
        })
        : null;

      recorderChunks = [];
      recorderStopResolver?.(blob);
      recorderStopResolver = null;
      mediaRecorder = null;
    };

    mediaRecorder.start();
  };

  const ensureModule = async () => {
    if (!moonshineModule) {
      moonshineModule = await import('@moonshine-ai/moonshine-js');
      moonshineModule.Settings.VERBOSE_LOGGING = config.verboseLogging ?? false;
    }

    return moonshineModule;
  };

  const cleanupAfterSegment = () => {
    clearDurationTimer();
    handlers.onAudioLevelChange?.(0);
    isSpeechActive = false;
    releaseStream();
    transcriber?.stop();
  };

  const emitSegment = async (attachment: AudioAttachment, transcriptText?: string) => {
    if (didEmitSegment || isCancelling) {
      return;
    }

    didEmitSegment = true;
    cleanupAfterSegment();
    handlers.onDurationChange?.(attachment.durationMs ?? currentDurationMs);
    handlers.onTranscriptChange?.(transcriptText ? { final: transcriptText } : {});
    handlers.onSegmentReady?.({
      attachment,
      transcript: transcriptText ? { final: transcriptText } : undefined,
      metadata: {
        source: transcriptText ? 'moonshine' : 'moonshine-manual-stop',
        model: config.modelUrl ?? DEFAULT_MODEL_URL,
        segmentCount: 1,
      },
    });
  };

  const callbacks: import('@moonshine-ai/moonshine-js').TranscriberCallbacks = {
    onModelLoadStarted() {
      handlers.onStateChange?.('preparing');
    },
    onModelLoaded() {
      if (!didEmitSegment && !isCancelling) {
        handlers.onStateChange?.('waiting_for_speech');
      }
    },
    onTranscribeStarted() {
      if (!didEmitSegment && !isCancelling) {
        handlers.onStateChange?.('waiting_for_speech');
      }
    },
    onTranscribeStopped() {
      handlers.onAudioLevelChange?.(0);
      if (!didEmitSegment && !isCancelling) {
        handlers.onStateChange?.('idle');
      }
    },
    onFrame(_probs, frame) {
      if (isSpeechActive) {
        handlers.onAudioLevelChange?.(computeLevelFromFrame(frame));
      }
    },
    onSpeechStart() {
      if (isCancelling || didEmitSegment) {
        return;
      }

      isSpeechActive = true;
      currentDurationMs = 0;
      segmentStartedAt = Date.now();
      handlers.onTranscriptChange?.({});
      handlers.onDurationChange?.(0);
      handlers.onStateChange?.('listening');
      startRecorder();
      clearDurationTimer();
      durationTimer = setInterval(() => {
        currentDurationMs = Math.max(0, Date.now() - segmentStartedAt);
        handlers.onDurationChange?.(currentDurationMs);
      }, 200);
    },
    onSpeechEnd() {
      if (isCancelling || didEmitSegment) {
        return;
      }

      isSpeechActive = false;
      clearDurationTimer();
      handlers.onStateChange?.('finishing');
      void stopRecorder();
    },
    onTranscriptionCommitted(text, buffer) {
      if (isCancelling || didEmitSegment) {
        return;
      }

      void (async () => {
        try {
          const attachment = buffer
            ? await audioBufferToAttachment(buffer)
            : (() => {
              throw new Error('Moonshine did not return audio for the committed segment');
            })();

          await emitSegment(attachment, text);
        } catch (error) {
          handlers.onError?.(normalizeError(error));
        }
      })();
    },
    onError(error) {
      handlers.onError?.(normalizeError(error));
    },
  };

  return {
    start: async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio capture is not supported in this browser');
      }

      isCancelling = false;
      resetSegmentFlags();
      handlers.onTranscriptChange?.({});
      handlers.onDurationChange?.(0);
      handlers.onStateChange?.('preparing');

      const moonshine = await ensureModule();

      if (!transcriber) {
        transcriber = new moonshine.Transcriber(
          config.modelUrl ?? DEFAULT_MODEL_URL,
          callbacks,
          true,
          config.precision ?? 'quantized',
        );
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          sampleRate: 16000,
          ...config.audioConstraints,
        },
      });

      transcriber.attachStream(mediaStream);
      await transcriber.start();
    },
    stop: async () => {
      if (isCancelling || didEmitSegment) {
        return;
      }

      handlers.onStateChange?.('finishing');
      clearDurationTimer();
      handlers.onAudioLevelChange?.(0);
      isSpeechActive = false;
      transcriber?.stop();
      releaseStream();

      const blob = await stopRecorder();
      if (isCancelling || didEmitSegment || !blob) {
        return;
      }

      await emitSegment(await blobToAttachment(blob, currentDurationMs || undefined));
    },
    cancel: async () => {
      isCancelling = true;
      clearDurationTimer();
      handlers.onAudioLevelChange?.(0);
      transcriber?.stop();
      releaseStream();
      await stopRecorder();
      handlers.onStateChange?.('idle');
      resetSegmentFlags();
      isCancelling = false;
    },
    destroy: async () => {
      isCancelling = true;
      clearDurationTimer();
      handlers.onAudioLevelChange?.(0);
      transcriber?.stop();
      releaseStream();
      await stopRecorder();
      handlers.onStateChange?.('idle');
      resetSegmentFlags();
    },
  };
};

export type { CreateVoiceProvider };
