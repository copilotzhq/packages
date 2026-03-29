# Voice Compose Implementation Spec

## Goal

Add an opt-in voice composer to `@copilotz/chat-ui` that can replace the bottom text input with a dominant audio capture experience while keeping the shared packages free of VAD/STT vendor dependencies by default.

## Product Shape

- Voice compose is not a global app mode.
- The user enters voice compose from the existing mic button in the chat composer.
- When active, the text input is replaced by a persistent voice composer in the same bottom area.
- The composer remains open until the user explicitly exits back to keyboard mode.
- Recording/listening remains explicit and provider-driven.
- Text replies remain unchanged.

## Scope

### Included

- Opt-in `voiceCompose` configuration in `ChatConfig`
- Voice composer UI states in `chat-ui`
- Default zero-dependency manual recording provider in `chat-ui`
- Provider interface for custom VAD/STT implementations per project
- Countdown review flow with `Send now` and `Cancel`
- Config labels for all visible copy
- Type re-exports through `chat-ui` and `chat-adapter`

### Not Included

- Built-in VAD
- Built-in STT
- Transcript editing
- TTS or spoken assistant replies
- Automatic Mobizap integration before a package publish

## UX Summary

### Entry

- If `voiceCompose.enabled` is `false`, the current inline recorder behavior remains unchanged.
- If `voiceCompose.enabled` is `true`, the mic button opens the voice composer and immediately attempts to start the provider.
- `voiceCompose.defaultMode` controls whether the composer initially opens in text or voice state.

### Voice Composer Behavior

- The text composer is replaced by a voice panel.
- The voice panel stays open until the user clicks the keyboard/back action.
- In the default manual provider:
  - the central orb starts recording
  - the same orb stops recording
- After a capture finishes, the panel enters a compact review state.
- Review starts an auto-send countdown.
- `Send now` sends immediately.
- `Cancel` pauses the auto-send countdown but keeps the draft visible.
- Once auto-send is paused, a compact record-again icon lets the user restart from the review state.
- Trash discards the draft and returns to idle voice compose.
- After send:
  - if `voiceCompose.persistComposer` is `true`, stay in voice compose idle
  - otherwise return to text compose

## State Model

The UI supports the full state superset below. The default provider only uses a subset.

- `idle`
- `preparing`
- `waiting_for_speech`
- `listening`
- `finishing`
- `review`
- `sending`
- `error`

### Default Manual Provider Usage

- `idle`
- `preparing`
- `listening`
- `review`
- `sending`
- `error`

### Future VAD/STT Provider Usage

- `waiting_for_speech`
- `finishing`
- partial transcript updates during `listening`
- final transcript during `review`

## Public API Additions

### `ChatConfig.labels`

Add voice-specific labels:

- `voiceEnter`
- `voiceExit`
- `voiceTitle`
- `voiceIdle`
- `voicePreparing`
- `voiceWaiting`
- `voiceListening`
- `voiceFinishing`
- `voiceReview`
- `voiceSending`
- `voiceStart`
- `voiceStop`
- `voiceSendNow`
- `voiceCancel`
- `voiceDiscard`
- `voiceRecordAgain`
- `voiceAutoSendIn`
- `voiceTranscriptPending`
- `voicePermissionDenied`
- `voiceCaptureError`

`voiceAutoSendIn` may include `{{seconds}}` and is interpolated by the UI.

### `ChatConfig.voiceCompose`

```ts
voiceCompose?: {
  enabled?: boolean;
  defaultMode?: "text" | "voice";
  autoSendDelayMs?: number;
  persistComposer?: boolean;
  showTranscriptPreview?: boolean;
  transcriptMode?: "none" | "final-only" | "partial-and-final";
  maxRecordingMs?: number;
  createProvider?: CreateVoiceProvider;
};
```

### Provider Contract

```ts
type VoiceComposerState =
  | "idle"
  | "preparing"
  | "waiting_for_speech"
  | "listening"
  | "finishing"
  | "review"
  | "sending"
  | "error";

type VoiceTranscript = {
  partial?: string;
  final?: string;
};

type VoiceSegment = {
  attachment: MediaAttachment & { kind: "audio" };
  transcript?: VoiceTranscript;
  metadata?: Record<string, unknown>;
};

type VoiceProviderHandlers = {
  onStateChange?: (state: VoiceComposerState) => void;
  onAudioLevelChange?: (level: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onTranscriptChange?: (transcript: VoiceTranscript) => void;
  onSegmentReady?: (segment: VoiceSegment) => void;
  onError?: (error: Error) => void;
};

type VoiceProviderOptions = {
  maxRecordingMs?: number;
};

interface VoiceProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void> | void;
  destroy(): Promise<void> | void;
}

type CreateVoiceProvider = (
  handlers: VoiceProviderHandlers,
  options?: VoiceProviderOptions,
) => Promise<VoiceProvider> | VoiceProvider;
```

## Default Shared-Lib Provider

The built-in provider is a manual recorder that depends only on browser APIs:

- `navigator.mediaDevices.getUserMedia`
- `MediaRecorder`
- `AudioContext` + `AnalyserNode` for level metering

### Behavior

- Start on explicit user action only
- No silence detection
- No transcript
- Emits one audio segment on stop
- Honors `maxRecordingMs` with automatic stop
- Returns the segment as an audio `MediaAttachment`

## Custom Provider Strategy

Projects can inject custom providers without changing `chat-ui`.

Examples:

- Ricky VAD only: smarter capture segmentation, no transcript
- Moonshine: VAD + local transcript preview
- Server-assisted provider: local capture with remote transcript

The shared packages should not ship those dependencies by default. Projects should lazy-load them inside their provider factory.

## `chat-adapter` Impact

No transport changes are required for the first version because audio attachments already flow through the existing adapter and Copilotz backend path.

Optional future work:

- include transcript metadata on send
- allow transcript to become message content behind config

## Mobizap Pilot Plan

After publishing a new package version:

1. update `clients/mobizap/web/package.json` to the new `@copilotz/chat-ui` / `@copilotz/chat-adapter`
2. enable `voiceCompose.enabled` in the Mobizap chat config
3. test with the built-in manual provider first
4. add a Mobizap-specific custom provider later if VAD/STT is desired

## Success Criteria

- Existing consumers remain unchanged unless `voiceCompose.enabled` is set
- Shared packages do not gain VAD/STT runtime dependencies
- The default voice composer works end-to-end with manual recording
- Custom providers can drive richer listening/transcript states without changing the shared UI
