import React from 'react';
import type { AudioAttachment, ChatConfig, VoiceComposerState, VoiceTranscript, VoiceTranscriptMode } from '../../types/chatTypes';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Keyboard, Loader2, Mic, Send, Square, Trash2, X } from 'lucide-react';

interface VoiceComposerProps {
  state: VoiceComposerState;
  transcript?: VoiceTranscript;
  transcriptMode: VoiceTranscriptMode;
  showTranscriptPreview: boolean;
  attachment?: AudioAttachment | null;
  durationMs: number;
  audioLevel: number;
  countdownMs: number;
  autoSendDelayMs: number;
  isAutoSendActive: boolean;
  errorMessage?: string | null;
  disabled?: boolean;
  labels?: ChatConfig['labels'];
  onStart: () => void;
  onStop: () => void;
  onCancelAutoSend: () => void;
  onDiscard: () => void;
  onRecordAgain: () => void;
  onSendNow: () => void;
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
      return labels?.voiceSending || 'Sending...';
    case 'error':
      return errorMessage || labels?.voiceCaptureError || 'Unable to capture audio.';
    case 'idle':
    default:
      return labels?.voiceIdle || 'Tap the mic to record';
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
  attachment,
  durationMs,
  audioLevel,
  countdownMs,
  autoSendDelayMs,
  isAutoSendActive,
  errorMessage,
  disabled = false,
  labels,
  onStart,
  onStop,
  onCancelAutoSend,
  onDiscard,
  onRecordAgain,
  onSendNow,
  onExit,
}) => {
  const transcriptText = resolveTranscriptText(transcript, transcriptMode);
  const countdownSeconds = Math.max(1, Math.ceil(countdownMs / 1000));
  const countdownValue = autoSendDelayMs > 0
    ? Math.min(100, Math.max(0, ((autoSendDelayMs - countdownMs) / autoSendDelayMs) * 100))
    : 100;
  const isBusy = state === 'preparing' || state === 'finishing' || state === 'sending';
  const isCapturing = state === 'waiting_for_speech' || state === 'listening';
  const isReviewing = state === 'review';
  const levelValue = isCapturing || state === 'preparing' || state === 'finishing'
    ? Math.max(8, Math.round(audioLevel * 100))
    : 0;
  const headerLabel = state === 'error'
    ? (labels?.voiceCaptureError || 'Unable to capture audio.')
    : resolveStateLabel(state, labels, errorMessage);

  return (
    <div className="w-full max-w-3xl rounded-xl border bg-background p-3 shadow-sm sm:p-4 md:min-w-3xl">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline">{labels?.voiceTitle || 'Voice'}</Badge>
          <span className="truncate text-xs sm:text-sm text-muted-foreground">
            {headerLabel}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2 sm:px-3"
          onClick={onExit}
          disabled={disabled || isBusy}
        >
          <Keyboard className="h-4 w-4" />
          <span className="hidden sm:inline">{labels?.voiceExit || 'Use keyboard'}</span>
        </Button>
      </div>

      {!isReviewing ? (
        <div className="mt-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-3 text-center sm:px-4 sm:py-4">
          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant={isCapturing ? 'destructive' : 'outline'}
              className={`h-16 w-16 rounded-full sm:h-20 sm:w-20 ${isCapturing ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'}`}
              onClick={isCapturing ? onStop : onStart}
              disabled={disabled || isBusy}
            >
              {isBusy ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : isCapturing ? (
                <Square className="h-7 w-7" />
              ) : (
                <Mic className="h-7 w-7" />
              )}
            </Button>

            <div className="w-full space-y-2">
              <Progress value={levelValue} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDuration(durationMs)}</span>
                <span>{isCapturing ? (labels?.voiceStop || 'Stop recording') : (labels?.voiceStart || 'Start recording')}</span>
              </div>
            </div>

            {showTranscriptPreview && transcriptMode !== 'none' && transcriptText && (
              <div className="w-full rounded-lg border bg-background px-3 py-2 text-left text-sm">
                {transcriptText}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {labels?.voiceReview || 'Ready to send'}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDuration(durationMs)}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onDiscard}
              disabled={disabled}
              aria-label={labels?.voiceDiscard || 'Delete recording'}
              title={labels?.voiceDiscard || 'Delete recording'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {attachment && (
            <div className="mt-3 rounded-lg bg-background p-2">
              <audio controls preload="metadata" className="w-full">
                <source src={attachment.dataUrl} type={attachment.mimeType} />
              </audio>
            </div>
          )}

          {showTranscriptPreview && transcriptMode !== 'none' && transcriptText && (
            <div className="mt-3 rounded-lg border bg-background px-3 py-2 text-left text-sm">
              {transcriptText}
            </div>
          )}

          {isAutoSendActive && autoSendDelayMs > 0 && (
            <div className="mt-3 space-y-2">
              <Progress value={countdownValue} className="h-2" />
              <div className="text-center text-xs text-muted-foreground">
                {interpolateSeconds(labels?.voiceAutoSendIn, countdownSeconds)}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            {isAutoSendActive && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancelAutoSend} disabled={disabled}>
                <X className="h-4 w-4" />
                {labels?.voiceCancel || 'Cancel'}
              </Button>
            )}
            {!isAutoSendActive && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onRecordAgain}
                disabled={disabled}
                aria-label={labels?.voiceRecordAgain || 'Record again'}
                title={labels?.voiceRecordAgain || 'Record again'}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" size="sm" onClick={onSendNow} disabled={disabled}>
              <Send className="h-4 w-4" />
              {labels?.voiceSendNow || 'Send now'}
            </Button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
