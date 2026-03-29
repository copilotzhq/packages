import React from 'react';
import type { ChatConfig, VoiceComposerState, VoiceTranscript, VoiceTranscriptMode } from '../../types/chatTypes';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Keyboard, Loader2, Mic, RotateCcw, Send, Square, X } from 'lucide-react';

interface VoiceComposerProps {
  state: VoiceComposerState;
  transcript?: VoiceTranscript;
  transcriptMode: VoiceTranscriptMode;
  showTranscriptPreview: boolean;
  durationMs: number;
  audioLevel: number;
  countdownMs: number;
  autoSendDelayMs: number;
  errorMessage?: string | null;
  disabled?: boolean;
  labels?: ChatConfig['labels'];
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onSendNow: () => void;
  onRecordAgain: () => void;
  onExit: () => void;
}

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const interpolateSeconds = (label: string | undefined, seconds: number): string => {
  if (!label) {
    return `Auto-sends in ${seconds}s`;
  }

  if (label.includes('{{seconds}}')) {
    return label.replace(/\{\{\s*seconds\s*\}\}/g, String(seconds));
  }

  return `${label} ${seconds}s`;
};

const resolveStateLabel = (state: VoiceComposerState, labels?: ChatConfig['labels'], errorMessage?: string | null): string => {
  switch (state) {
    case 'preparing':
      return labels?.voicePreparing || 'Preparing microphone...';
    case 'waiting_for_speech':
      return labels?.voiceWaiting || 'Waiting for speech...';
    case 'listening':
      return labels?.voiceListening || 'Listening...';
    case 'finishing':
      return labels?.voiceFinishing || 'Finishing capture...';
    case 'review':
      return labels?.voiceReview || 'Ready to send';
    case 'sending':
      return 'Sending...';
    case 'error':
      return errorMessage || labels?.voiceCaptureError || 'Unable to capture audio.';
    case 'idle':
    default:
      return labels?.voiceTitle || 'Voice input';
  }
};

const resolveTranscriptText = (
  transcript: VoiceTranscript | undefined,
  transcriptMode: VoiceTranscriptMode,
): string | null => {
  if (transcriptMode === 'none' || !transcript) {
    return null;
  }

  if (transcriptMode === 'final-only') {
    return transcript.final?.trim() || null;
  }

  return transcript.final?.trim() || transcript.partial?.trim() || null;
};

export const VoiceComposer: React.FC<VoiceComposerProps> = ({
  state,
  transcript,
  transcriptMode,
  showTranscriptPreview,
  durationMs,
  audioLevel,
  countdownMs,
  autoSendDelayMs,
  errorMessage,
  disabled = false,
  labels,
  onStart,
  onStop,
  onCancel,
  onSendNow,
  onRecordAgain,
  onExit,
}) => {
  const transcriptText = resolveTranscriptText(transcript, transcriptMode);
  const countdownSeconds = Math.max(1, Math.ceil(countdownMs / 1000));
  const countdownValue = autoSendDelayMs > 0
    ? Math.min(100, Math.max(0, ((autoSendDelayMs - countdownMs) / autoSendDelayMs) * 100))
    : 100;
  const isBusy = state === 'preparing' || state === 'finishing' || state === 'sending';
  const isCapturing = state === 'waiting_for_speech' || state === 'listening';
  const levelValue = isCapturing || state === 'preparing' || state === 'finishing'
    ? Math.max(8, Math.round(audioLevel * 100))
    : 0;

  return (
    <div className="w-full md:min-w-3xl max-w-3xl rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{labels?.voiceTitle || 'Voice input'}</Badge>
          <span className="text-sm text-muted-foreground">
            {resolveStateLabel(state, labels, errorMessage)}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onExit}
          disabled={disabled || isBusy}
        >
          <Keyboard className="h-4 w-4" />
          {labels?.voiceExit || 'Use keyboard'}
        </Button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          {isBusy ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : isCapturing ? (
            <Square className="h-8 w-8 text-primary" />
          ) : (
            <Mic className="h-8 w-8 text-primary" />
          )}
        </div>

        <div className="w-full max-w-md space-y-2">
          <Progress value={levelValue} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDuration(durationMs)}</span>
            <span>{resolveStateLabel(state, labels, errorMessage)}</span>
          </div>
        </div>

        {showTranscriptPreview && transcriptMode !== 'none' && transcriptText && (
          <div className="w-full max-w-md rounded-lg border bg-background px-3 py-2 text-left text-sm">
            {transcriptText}
          </div>
        )}
      </div>

      {state === 'review' && autoSendDelayMs > 0 && (
        <div className="mt-4 space-y-2">
          <Progress value={countdownValue} className="h-2" />
          <div className="text-center text-xs text-muted-foreground">
            {interpolateSeconds(labels?.voiceAutoSendIn, countdownSeconds)}
          </div>
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {state === 'idle' && (
          <Button type="button" onClick={onStart} disabled={disabled}>
            <Mic className="h-4 w-4" />
            {labels?.voiceStart || 'Start recording'}
          </Button>
        )}

        {isCapturing && (
          <>
            <Button type="button" onClick={onStop} disabled={disabled}>
              <Square className="h-4 w-4" />
              {labels?.voiceStop || 'Stop recording'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
              <X className="h-4 w-4" />
              {labels?.voiceCancel || 'Cancel'}
            </Button>
          </>
        )}

        {state === 'review' && (
          <>
            <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
              <X className="h-4 w-4" />
              {labels?.voiceCancel || 'Cancel'}
            </Button>
            <Button type="button" variant="outline" onClick={onRecordAgain} disabled={disabled}>
              <RotateCcw className="h-4 w-4" />
              {labels?.voiceRecordAgain || 'Record again'}
            </Button>
            <Button type="button" onClick={onSendNow} disabled={disabled}>
              <Send className="h-4 w-4" />
              {labels?.voiceSendNow || 'Send now'}
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
              <X className="h-4 w-4" />
              {labels?.voiceCancel || 'Cancel'}
            </Button>
            <Button type="button" onClick={onRecordAgain} disabled={disabled}>
              <RotateCcw className="h-4 w-4" />
              {labels?.voiceRecordAgain || 'Record again'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
