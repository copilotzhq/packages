import type {
  CreateVoiceProvider,
  VoiceProvider,
  VoiceProviderHandlers,
  VoiceProviderOptions,
} from '../types/chatTypes';

const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

const pickRecorderMimeType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined;

  for (const mimeType of AUDIO_MIME_TYPES) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return undefined;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read recorded audio'));
    reader.readAsDataURL(blob);
  });

const stopStream = (stream: MediaStream | null) => {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
};

const closeAudioContext = async (audioContext: AudioContext | null) => {
  if (!audioContext) return;

  try {
    await audioContext.close();
  } catch {
    // Ignore close errors from partially-initialized contexts.
  }
};

const emitDuration = (handlers: VoiceProviderHandlers, startedAt: number) => {
  handlers.onDurationChange?.(Math.max(0, Date.now() - startedAt));
};

export const createManualVoiceProvider: CreateVoiceProvider = async (
  handlers,
  options = {},
): Promise<VoiceProvider> => {
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let levelData: Uint8Array | null = null;
  let levelFrame = 0;
  let durationTimer: ReturnType<typeof setInterval> | null = null;
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let startedAt = 0;
  let shouldEmitSegment = true;
  let isStarting = false;

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

  const stopLevelLoop = () => {
    if (levelFrame) {
      cancelAnimationFrame(levelFrame);
      levelFrame = 0;
    }
    handlers.onAudioLevelChange?.(0);
  };

  const startLevelLoop = () => {
    if (!analyser || !levelData) return;

    const tick = () => {
      if (!analyser || !levelData) return;

      analyser.getByteTimeDomainData(levelData);
      let sum = 0;
      for (let index = 0; index < levelData.length; index += 1) {
        const centered = (levelData[index] - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / levelData.length);
      handlers.onAudioLevelChange?.(Math.min(1, rms * 4));
      levelFrame = requestAnimationFrame(tick);
    };

    tick();
  };

  const cleanupActiveResources = async () => {
    clearTimers();
    stopLevelLoop();
    stopStream(mediaStream);
    mediaStream = null;
    analyser = null;
    levelData = null;
    await closeAudioContext(audioContext);
    audioContext = null;
  };

  const finalizeStop = async () => {
    mediaRecorder = null;
    isStarting = false;
    await cleanupActiveResources();
  };

  const start = async () => {
    if (isStarting || mediaRecorder?.state === 'recording') {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Audio capture is not supported in this browser');
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    isStarting = true;
    shouldEmitSegment = true;
    handlers.onTranscriptChange?.({});
    handlers.onDurationChange?.(0);
    handlers.onAudioLevelChange?.(0);
    handlers.onStateChange?.('preparing');

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      mediaRecorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream);

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        const error = event.error ?? new Error('Audio recorder failed');
        handlers.onError?.(error);
      };

      mediaRecorder.onstop = async () => {
        const durationMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;

        try {
          if (shouldEmitSegment && chunks.length > 0) {
            const blob = new Blob(chunks, {
              type: mediaRecorder?.mimeType || mimeType || 'audio/webm',
            });
            const dataUrl = await blobToDataUrl(blob);

            handlers.onSegmentReady?.({
              attachment: {
                kind: 'audio',
                dataUrl,
                mimeType: blob.type || 'audio/webm',
                durationMs,
                fileName: `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
                size: blob.size,
              },
              metadata: { source: 'manual' },
            });
          } else {
            handlers.onStateChange?.('idle');
          }
        } catch (error) {
          handlers.onError?.(error as Error);
        } finally {
          await finalizeStop();
        }
      };

      const AudioContextCtor = globalThis.AudioContext ||
        (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioContextCtor) {
        audioContext = new AudioContextCtor();
        await audioContext.resume().catch(() => undefined);
        const sourceNode = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        levelData = new Uint8Array(analyser.fftSize);
        sourceNode.connect(analyser);
        startLevelLoop();
      }

      startedAt = Date.now();
      emitDuration(handlers, startedAt);
      durationTimer = setInterval(() => emitDuration(handlers, startedAt), 200);
      if (options.maxRecordingMs && options.maxRecordingMs > 0) {
        maxDurationTimer = setTimeout(() => {
          void stop();
        }, options.maxRecordingMs);
      }

      mediaRecorder.start();
      handlers.onStateChange?.('listening');
    } catch (error) {
      isStarting = false;
      await cleanupActiveResources();
      throw error;
    }
  };

  const stop = async () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return;
    }

    handlers.onStateChange?.('finishing');
    mediaRecorder.stop();
  };

  const cancel = async () => {
    shouldEmitSegment = false;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      return;
    }

    await finalizeStop();
    handlers.onStateChange?.('idle');
  };

  const destroy = async () => {
    await cancel();
  };

  return {
    start,
    stop,
    cancel,
    destroy,
  };
};

export const resolveVoiceProviderFactory = (
  createProvider?: CreateVoiceProvider,
): CreateVoiceProvider => createProvider ?? createManualVoiceProvider;
