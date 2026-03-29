declare module '@moonshine-ai/moonshine-js' {
  export type MoonshineError = string;

  export interface TranscriberCallbacks {
    onPermissionsRequested?: () => void;
    onError?: (error: MoonshineError | Error) => void;
    onModelLoadStarted?: () => void;
    onModelLoaded?: () => void;
    onTranscribeStarted?: () => void;
    onTranscribeStopped?: () => void;
    onTranscriptionUpdated?: (text: string) => void;
    onTranscriptionCommitted?: (text: string, buffer?: AudioBuffer) => void;
    onFrame?: (probs: unknown, frame: Float32Array, ema: number) => void;
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
  }

  export class Transcriber {
    constructor(
      modelURL: string,
      callbacks?: Partial<TranscriberCallbacks>,
      useVAD?: boolean,
      precision?: string,
    );
    attachStream(stream: MediaStream): void;
    start(): Promise<void>;
    stop(): void;
    isActive: boolean;
  }

  export const Settings: {
    BASE_ASSET_PATH: {
      MOONSHINE: string;
      ONNX_RUNTIME: string;
      SILERO_VAD: string;
    };
    VERBOSE_LOGGING: boolean;
  };
}
