import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useChatUserContext } from './UserContext';
import {
  AgentOption,
  MediaAttachment,
  FileUploadProgress,
  ChatConfig,
  VoiceComposerState,
  VoiceProvider,
  VoiceSegment,
  VoiceTranscript,
} from '../../types/chatTypes';
import { createObjectUrlFromDataUrl, formatFileSize, getAttachmentKindFromMimeType } from '../../lib/utils';
import { appendVoiceSegments, mergeVoiceTranscripts, resolveVoiceProviderFactory } from '../../lib/voiceCompose';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { VoiceComposer } from './VoiceComposer';
import {
  Send,
  Paperclip,
  Mic,
  Image,
  Video,
  FileText,
  X,
  Square,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: string, attachments: MediaAttachment[]) => void;
  attachments: MediaAttachment[];
  onAttachmentsChange: (attachments: MediaAttachment[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isGenerating?: boolean;
  onStopGeneration?: () => void;
  enableFileUpload?: boolean;
  enableAudioRecording?: boolean;
  maxAttachments?: number;
  maxFileSize?: number;
  acceptedFileTypes?: string[];
  className?: string;
  config?: ChatConfig;
  mentionAgents?: AgentOption[];
  onTargetAgentChange?: (agentId: string | null) => void;
}

interface MentionMatch {
  start: number;
  end: number;
  query: string;
}

function getActiveMentionMatch(value: string, caret: number): MentionMatch | null {
  const prefix = value.slice(0, caret);
  const match = /(^|\s)@([\w.-]*)$/.exec(prefix);
  if (!match) return null;

  const query = match[2] ?? '';
  return {
    start: prefix.length - query.length - 1,
    end: caret,
    query,
  };
}

function resolveTargetFromMentions(
  value: string,
  agents: AgentOption[],
): AgentOption | null {
  const matches = value.matchAll(/(^|\s)@([\w.-]+)/g);

  for (const match of matches) {
    const mention = match[2]?.toLowerCase();
    if (!mention) continue;

    const agent = agents.find((candidate) =>
      candidate.id.toLowerCase() === mention ||
      candidate.name.toLowerCase() === mention
    );
    if (agent) return agent;
  }

  return null;
}

// File upload progress component - memoized
const FileUploadItem: React.FC<{
  file: { name: string; type?: string; size?: number };
  progress: number;
  onCancel: () => void;
}> = memo(function FileUploadItem({ file, progress, onCancel }) {
  const guessTypeFromName = (name?: string): string => {
    const ext = (name || '').split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'bmp':
      case 'svg':
        return 'image/*';
      case 'mp4':
      case 'mov':
      case 'm4v':
      case 'webm':
        return 'video/*';
      case 'mp3':
      case 'wav':
      case 'm4a':
      case 'ogg':
        return 'audio/*';
      default:
        return '';
    }
  };

  const getFileIcon = (type?: string, name?: string) => {
    const t = typeof type === 'string' && type.length > 0 ? type : guessTypeFromName(name);
    if (t.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (t.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (t.startsWith('audio/')) return <Mic className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="relative">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {getFileIcon(file.type, file.name)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size ?? 0)}
            </p>
            <Progress value={progress} className="h-1 mt-1" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCancel}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// Attachment preview component - memoized
const AttachmentPreview: React.FC<{
  attachment: MediaAttachment;
  onRemove: () => void;
}> = memo(function AttachmentPreview({ attachment, onRemove }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPlaybackSrc, setAudioPlaybackSrc] = useState(attachment.dataUrl);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (attachment.kind !== 'audio' || !attachment.dataUrl.startsWith('data:')) {
      setAudioPlaybackSrc(attachment.dataUrl);
      return;
    }

    const objectUrl = createObjectUrlFromDataUrl(attachment.dataUrl);
    if (!objectUrl) {
      setAudioPlaybackSrc(attachment.dataUrl);
      return;
    }

    setAudioPlaybackSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.kind, attachment.dataUrl]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <Card className="relative group">
      <CardContent className="p-2">
        {attachment.kind === 'image' && (
          <div className="relative">
            <img
              src={attachment.dataUrl}
              alt={attachment.fileName || 'Attachment'}
              className="w-full h-20 object-cover rounded"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {attachment.kind === 'video' && (
          <div className="relative">
            <video
              src={attachment.dataUrl}
              poster={attachment.poster}
              className="w-full h-20 object-cover rounded"
              muted
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Badge className="absolute bottom-1 right-1 text-xs">
              {formatDuration(attachment.durationMs)}
            </Badge>
          </div>
        )}

        {attachment.kind === 'audio' && (
          <div className="flex items-center gap-2 p-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePlayPause}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            <div className="flex-1">
              <p className="text-xs font-medium">
                {attachment.fileName || 'Audio'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(attachment.durationMs)}
              </p>
            </div>
            <audio
              ref={audioRef}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            >
              <source src={audioPlaybackSrc} type={attachment.mimeType} />
            </audio>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {attachment.kind === 'file' && (
          <div className="flex min-w-48 items-center gap-2 p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {attachment.fileName || 'File'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[attachment.mimeType || 'File', formatFileSize(attachment.size)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={onRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {attachment.fileName && attachment.kind !== 'audio' && attachment.kind !== 'file' && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b">
            <p className="truncate">{attachment.fileName}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const resolveVoiceErrorMessage = (error: unknown, config?: ChatConfig): string => {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return config?.labels?.voicePermissionDenied || 'Microphone access was denied.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return config?.labels?.voiceCaptureError || 'Unable to capture audio.';
};

const clearVoiceTranscript = (): VoiceTranscript => ({});
const resolveVoiceSegmentDuration = (segment: VoiceSegment): number => segment.attachment.durationMs ?? 0;

export const ChatInput: React.FC<ChatInputProps> = memo(function ChatInput({
  value,
  onChange,
  onSubmit,
  attachments,
  onAttachmentsChange,
  placeholder = 'Type your message...',
  disabled = false,
  isGenerating = false,
  onStopGeneration,
  enableFileUpload = true,
  enableAudioRecording = true,
  maxAttachments = 4,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = [],
  className = '',
  config,
  mentionAgents = [],
  onTargetAgentChange,
}: ChatInputProps) {
  const voiceDefaultMode = config?.voiceCompose?.defaultMode ?? 'text';
  const voiceReviewMode = config?.voiceCompose?.reviewMode ?? 'manual';
  const voiceAutoSendDelayMs = config?.voiceCompose?.autoSendDelayMs ?? 5000;
  const voicePersistComposer = config?.voiceCompose?.persistComposer ?? true;
  const voiceShowTranscriptPreview = config?.voiceCompose?.showTranscriptPreview ?? true;
  const voiceTranscriptMode = config?.voiceCompose?.transcriptMode ?? 'final-only';
  const voiceMaxRecordingMs = config?.voiceCompose?.maxRecordingMs;

  const { setContext } = useChatUserContext();
  const [uploadProgress, setUploadProgress] = useState<Map<string, FileUploadProgress>>(new Map());
  const [isVoiceComposerOpen, setIsVoiceComposerOpen] = useState(
    () => enableAudioRecording && voiceDefaultMode === 'voice',
  );
  const [voiceState, setVoiceState] = useState<VoiceComposerState>('idle');
  const [voiceDraft, setVoiceDraft] = useState<VoiceSegment | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<VoiceTranscript>(clearVoiceTranscript);
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [voiceAudioLevel, setVoiceAudioLevel] = useState(0);
  const [voiceCountdownMs, setVoiceCountdownMs] = useState(0);
  const [isVoiceAutoSendActive, setIsVoiceAutoSendActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [activeMention, setActiveMention] = useState<MentionMatch | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);
  const voiceDraftRef = useRef<VoiceSegment | null>(null);
  const voiceAppendBaseRef = useRef<VoiceSegment | null>(null);
  const voiceAppendBaseDurationRef = useRef(0);

  const filteredMentionAgents = React.useMemo(() => {
    if (!activeMention || mentionAgents.length === 0) return [];

    const query = activeMention.query.trim().toLowerCase();
    const rank = (agent: AgentOption) => {
      const id = agent.id.toLowerCase();
      const name = agent.name.toLowerCase();
      if (!query) return 0;
      if (name.startsWith(query) || id.startsWith(query)) return 0;
      if (name.includes(query) || id.includes(query)) return 1;
      return 2;
    };

    return mentionAgents
      .filter((agent) => rank(agent) < 2)
      .sort((left, right) => {
        const rankDiff = rank(left) - rank(right);
        if (rankDiff !== 0) return rankDiff;
        return left.name.localeCompare(right.name);
      })
      .slice(0, 6);
  }, [activeMention, mentionAgents]);

  const isMentionMenuOpen = filteredMentionAgents.length > 0;

  const syncMentionState = useCallback((nextValue: string, nextCaret?: number) => {
    const caret = typeof nextCaret === 'number'
      ? nextCaret
      : textareaRef.current?.selectionStart ?? nextValue.length;
    const nextMatch = getActiveMentionMatch(nextValue, caret);
    setActiveMention((prev) => {
      if (
        prev?.start === nextMatch?.start &&
        prev?.end === nextMatch?.end &&
        prev?.query === nextMatch?.query
      ) {
        return prev;
      }
      return nextMatch;
    });
    setActiveMentionIndex(0);
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (voiceProviderRef.current) {
        void voiceProviderRef.current.destroy();
        voiceProviderRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    voiceDraftRef.current = voiceDraft;
  }, [voiceDraft]);

  useEffect(() => {
    if (!isMentionMenuOpen) {
      setActiveMentionIndex(0);
      return;
    }
    setActiveMentionIndex((prev) =>
      prev >= filteredMentionAgents.length ? 0 : prev,
    );
  }, [filteredMentionAgents.length, isMentionMenuOpen]);

  const selectMentionAgent = useCallback((agent: AgentOption) => {
    if (!activeMention) return;

    const replacement = `@${agent.name} `;
    const nextValue =
      value.slice(0, activeMention.start) +
      replacement +
      value.slice(activeMention.end);
    const nextCaret = activeMention.start + replacement.length;

    onChange(nextValue);
    onTargetAgentChange?.(agent.id);
    setActiveMention(null);
    setActiveMentionIndex(0);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }, [activeMention, onChange, onTargetAgentChange, value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!value.trim() && attachments.length === 0) || disabled || isGenerating) return;

    const mentionedAgent = resolveTargetFromMentions(value, mentionAgents);
    if (mentionedAgent) {
      onTargetAgentChange?.(mentionedAgent.id);
    }

    onSubmit(value.trim(), attachments);
    onChange('');
    onAttachmentsChange([]);
    setActiveMention(null);
    setActiveMentionIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isMentionMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIndex((prev) =>
          prev >= filteredMentionAgents.length - 1 ? 0 : prev + 1,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex((prev) =>
          prev <= 0 ? filteredMentionAgents.length - 1 : prev - 1,
        );
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filteredMentionAgents[activeMentionIndex]) {
        e.preventDefault();
        selectMentionAgent(filteredMentionAgents[activeMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveMention(null);
        setActiveMentionIndex(0);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && window.innerWidth > 768) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const processFile = async (file: File): Promise<MediaAttachment | null> => {
    if (file.size > maxFileSize) {
      alert(`File too large. Max allowed: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return null;
    }

    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Start upload progress
    setUploadProgress(prev => new Map(prev.set(fileId, {
      fileName: file.name,
      progress: 0,
      status: 'uploading',
    })));

    try {
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(prev => new Map(prev.set(fileId, {
          fileName: file.name,
          progress,
          status: 'uploading',
        })));
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });

      const attachment: MediaAttachment = {
        kind: getAttachmentKindFromMimeType(file.type),
        dataUrl,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name,
        size: file.size,
      };

      // For video files, try to get duration
      if (attachment.kind === 'video') {
        try {
          const video = document.createElement('video');
          video.src = dataUrl;
          await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
          });
          attachment.durationMs = video.duration * 1000;
        } catch (error) {
          console.warn('Could not get video duration:', error);
        }
      }

      // If it's an image, mark as latest reference image in shared context
      if (attachment.kind === 'image') {
        setContext({ lastReferenceImage: { dataUrl: attachment.dataUrl, mimeType: attachment.mimeType, addedAt: Date.now() } });
      }
      return attachment;
    } catch (error) {
      console.error('Error processing file:', error);
      setUploadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      alert('Failed to process file');
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = maxAttachments - attachments.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const attachment = await processFile(file);
      if (attachment) {
        onAttachmentsChange([...attachments, attachment]);
      }
    }

    // Reset input
    e.target.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (!enableFileUpload) return;

    const files = Array.from(e.dataTransfer.files);
    const remainingSlots = maxAttachments - attachments.length;
    const filesToProcess = files.slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const attachment = await processFile(file);
      if (attachment) {
        onAttachmentsChange([...attachments, attachment]);
      }
    }
  }, [attachments, enableFileUpload, maxAttachments, onAttachmentsChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const resetVoiceComposerState = useCallback((nextState: VoiceComposerState = 'idle') => {
    setVoiceState(nextState);
    setVoiceDraft(null);
    voiceDraftRef.current = null;
    voiceAppendBaseRef.current = null;
    voiceAppendBaseDurationRef.current = 0;
    setVoiceTranscript(clearVoiceTranscript());
    setVoiceDurationMs(0);
    setVoiceAudioLevel(0);
    setVoiceCountdownMs(0);
    setIsVoiceAutoSendActive(false);
    setVoiceError(null);
  }, []);

  const armVoiceDraftForAppend = useCallback((segment: VoiceSegment | null) => {
    voiceAppendBaseRef.current = segment;
    voiceAppendBaseDurationRef.current = segment ? resolveVoiceSegmentDuration(segment) : 0;
  }, []);

  const handleVoiceProviderStateChange = useCallback((nextState: VoiceComposerState) => {
    if (
      voiceReviewMode === 'armed' &&
      (nextState === 'waiting_for_speech' || nextState === 'listening')
    ) {
      const currentDraft = voiceDraftRef.current;
      if (currentDraft) {
        armVoiceDraftForAppend(currentDraft);
      }
    }

    if (
      voiceReviewMode === 'armed' &&
      nextState === 'listening' &&
      voiceDraftRef.current
    ) {
      setVoiceCountdownMs(voiceAutoSendDelayMs);
      setIsVoiceAutoSendActive(false);
    }

    setVoiceState(nextState);
  }, [armVoiceDraftForAppend, voiceAutoSendDelayMs, voiceReviewMode]);

  const ensureVoiceProvider = useCallback(async () => {
    if (voiceProviderRef.current) {
      return voiceProviderRef.current;
    }

    const createProvider = resolveVoiceProviderFactory(config?.voiceCompose?.createProvider);
    const provider = await createProvider({
      onStateChange: handleVoiceProviderStateChange,
      onAudioLevelChange: setVoiceAudioLevel,
      onDurationChange: (durationMs) => {
        setVoiceDurationMs(voiceAppendBaseDurationRef.current + durationMs);
      },
      onTranscriptChange: (transcript) => {
        const baseTranscript = voiceAppendBaseRef.current?.transcript;
        setVoiceTranscript(
          baseTranscript
            ? mergeVoiceTranscripts(baseTranscript, transcript)
            : transcript,
        );
      },
      onSegmentReady: (segment) => {
        void (async () => {
          const previousSegment = voiceAppendBaseRef.current;

          try {
            const nextSegment = previousSegment
              ? await appendVoiceSegments(previousSegment, segment)
              : segment;

            voiceDraftRef.current = nextSegment;
            setVoiceDraft(nextSegment);
            setVoiceTranscript(nextSegment.transcript ?? clearVoiceTranscript());
            setVoiceDurationMs(resolveVoiceSegmentDuration(nextSegment));
            setVoiceAudioLevel(0);
            setVoiceCountdownMs(voiceAutoSendDelayMs);
            setIsVoiceAutoSendActive(voiceAutoSendDelayMs > 0);
            setVoiceError(null);
            if (voiceReviewMode === 'armed') {
              armVoiceDraftForAppend(nextSegment);
            } else {
              armVoiceDraftForAppend(null);
            }
            setVoiceState((currentState) =>
              voiceReviewMode === 'armed' && (
                currentState === 'waiting_for_speech' ||
                currentState === 'listening'
              )
                ? currentState
                : 'review');
          } catch (error) {
            const resolvedError = resolveVoiceErrorMessage(error, config);

            armVoiceDraftForAppend(null);
            setVoiceAudioLevel(0);
            setVoiceCountdownMs(0);
            setIsVoiceAutoSendActive(false);

            if (previousSegment) {
              voiceDraftRef.current = previousSegment;
              setVoiceDraft(previousSegment);
              setVoiceTranscript(previousSegment.transcript ?? clearVoiceTranscript());
              setVoiceDurationMs(resolveVoiceSegmentDuration(previousSegment));
              setVoiceError(resolvedError);
              setVoiceState('review');
              return;
            }

            voiceDraftRef.current = null;
            setVoiceDraft(null);
            setVoiceTranscript(clearVoiceTranscript());
            setVoiceDurationMs(0);
            setVoiceError(resolvedError);
            setVoiceState('error');
          }
        })();
      },
      onError: (error) => {
        const previousSegment = voiceAppendBaseRef.current;
        armVoiceDraftForAppend(null);
        setVoiceError(resolveVoiceErrorMessage(error, config));
        setVoiceAudioLevel(0);
        setVoiceCountdownMs(0);
        setIsVoiceAutoSendActive(false);

        if (previousSegment) {
          voiceDraftRef.current = previousSegment;
          setVoiceDraft(previousSegment);
          setVoiceTranscript(previousSegment.transcript ?? clearVoiceTranscript());
          setVoiceDurationMs(resolveVoiceSegmentDuration(previousSegment));
          setVoiceState('review');
          return;
        }

        voiceDraftRef.current = null;
        setVoiceDraft(null);
        setVoiceTranscript(clearVoiceTranscript());
        setVoiceDurationMs(0);
        setVoiceState('error');
      },
    }, {
      maxRecordingMs: voiceMaxRecordingMs,
    });

    voiceProviderRef.current = provider;
    return provider;
  }, [armVoiceDraftForAppend, config, handleVoiceProviderStateChange, voiceAutoSendDelayMs, voiceMaxRecordingMs, voiceReviewMode]);

  const closeVoiceComposer = useCallback(async () => {
    voiceAppendBaseRef.current = null;
    voiceAppendBaseDurationRef.current = 0;
    setIsVoiceComposerOpen(false);
    setVoiceError(null);
    setVoiceCountdownMs(0);
    setVoiceAudioLevel(0);
    setVoiceTranscript(clearVoiceTranscript());
    setVoiceDraft(null);
    voiceDraftRef.current = null;
    setVoiceDurationMs(0);
    setVoiceState('idle');

    if (voiceProviderRef.current) {
      await voiceProviderRef.current.cancel();
    }
  }, []);

  const startVoiceCapture = useCallback(async (appendToDraft = false) => {
    if (disabled || isGenerating) {
      return;
    }

    const previousDraft = appendToDraft ? voiceDraftRef.current : null;
    const previousDurationMs = previousDraft ? resolveVoiceSegmentDuration(previousDraft) : 0;

    setIsVoiceComposerOpen(true);
    setVoiceError(null);
    setVoiceCountdownMs(0);
    setVoiceAudioLevel(0);
    setIsVoiceAutoSendActive(false);
    voiceAppendBaseRef.current = previousDraft;
    voiceAppendBaseDurationRef.current = previousDurationMs;

    if (!previousDraft) {
      setVoiceDraft(null);
      voiceDraftRef.current = null;
      setVoiceTranscript(clearVoiceTranscript());
      setVoiceDurationMs(0);
    } else {
      setVoiceTranscript(previousDraft.transcript ?? clearVoiceTranscript());
      setVoiceDurationMs(previousDurationMs);
    }

    try {
      const provider = await ensureVoiceProvider();
      await provider.start();
    } catch (error) {
      const resolvedError = resolveVoiceErrorMessage(error, config);
      voiceAppendBaseRef.current = null;
      voiceAppendBaseDurationRef.current = 0;
      setVoiceAudioLevel(0);
      setVoiceCountdownMs(0);
      setIsVoiceAutoSendActive(false);

      if (previousDraft) {
        voiceDraftRef.current = previousDraft;
        setVoiceDraft(previousDraft);
        setVoiceTranscript(previousDraft.transcript ?? clearVoiceTranscript());
        setVoiceDurationMs(previousDurationMs);
        setVoiceError(resolvedError);
        setVoiceState('review');
        return;
      }

      voiceDraftRef.current = null;
      setVoiceDraft(null);
      setVoiceTranscript(clearVoiceTranscript());
      setVoiceDurationMs(0);
      setVoiceError(resolvedError);
      setVoiceState('error');
    }
  }, [disabled, isGenerating, ensureVoiceProvider, config]);

  const stopVoiceCapture = useCallback(async () => {
    if (!voiceProviderRef.current) return;

    try {
      await voiceProviderRef.current.stop();
    } catch (error) {
      setVoiceError(resolveVoiceErrorMessage(error, config));
      setVoiceState('error');
    }
  }, [config]);

  const cancelVoiceCapture = useCallback(async () => {
    voiceAppendBaseRef.current = null;
    voiceAppendBaseDurationRef.current = 0;
    if (voiceProviderRef.current) {
      await voiceProviderRef.current.cancel();
    }

    resetVoiceComposerState('idle');
  }, [resetVoiceComposerState]);

  const finalizeVoiceComposerAfterSend = useCallback(() => {
    if (voicePersistComposer) {
      resetVoiceComposerState('idle');
      setIsVoiceComposerOpen(true);
      return;
    }

    void closeVoiceComposer();
  }, [voicePersistComposer, resetVoiceComposerState, closeVoiceComposer]);

  const sendVoiceDraft = useCallback(() => {
    void (async () => {
      if (!voiceDraft || disabled || isGenerating) {
        return;
      }

      setVoiceState('sending');
      setVoiceCountdownMs(0);
      setIsVoiceAutoSendActive(false);

      if (voiceProviderRef.current) {
        await voiceProviderRef.current.cancel();
      }

      onSubmit('', [...attachments, voiceDraft.attachment]);
      onChange('');
      onAttachmentsChange([]);
      finalizeVoiceComposerAfterSend();
    })();
  }, [
    voiceDraft,
    disabled,
    isGenerating,
    onSubmit,
    attachments,
    onChange,
    onAttachmentsChange,
    finalizeVoiceComposerAfterSend,
  ]);

  const cancelVoiceAutoSend = useCallback(() => {
    void (async () => {
      if (voiceReviewMode === 'armed' && voiceProviderRef.current) {
        await voiceProviderRef.current.cancel();
      }

      armVoiceDraftForAppend(null);
      setVoiceAudioLevel(0);
      setVoiceState('review');
    })();

    setVoiceCountdownMs(0);
    setIsVoiceAutoSendActive(false);
  }, [armVoiceDraftForAppend, voiceReviewMode]);

  const pauseVoiceReview = useCallback(async () => {
    if (voiceState === 'listening') {
      await stopVoiceCapture();
      return;
    }

    if (voiceReviewMode === 'armed' && voiceProviderRef.current) {
      await voiceProviderRef.current.cancel();
    }

    armVoiceDraftForAppend(null);
    setVoiceAudioLevel(0);
    setVoiceState('review');
  }, [armVoiceDraftForAppend, stopVoiceCapture, voiceReviewMode, voiceState]);

  useEffect(() => {
    if (
      !voiceDraft ||
      voiceAutoSendDelayMs <= 0 ||
      !isVoiceAutoSendActive
    ) {
      return;
    }

    const canContinueCounting = voiceState === 'review' || (
      voiceReviewMode === 'armed' &&
      voiceState === 'waiting_for_speech'
    );

    if (!canContinueCounting) {
      return;
    }

    const timer = setInterval(() => {
      setVoiceCountdownMs((previous) => {
        const remaining = Math.max(0, previous - 100);

        if (remaining <= 0) {
          clearInterval(timer);
          queueMicrotask(() => {
            sendVoiceDraft();
          });
        }

        return remaining;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [voiceState, voiceDraft, voiceReviewMode, voiceAutoSendDelayMs, isVoiceAutoSendActive, sendVoiceDraft]);

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  const canAddMoreAttachments = attachments.length < maxAttachments;
  const showVoiceComposer = enableAudioRecording && isVoiceComposerOpen;

  return (
    <TooltipProvider>
      {/* <Card className={`border-t py-0 bg-transparent ${className}`}> */}
      {/* <CardContent className="p-4 pb-1 space-y-4 bg-transparent"> */}
      {/* Upload progress */}
      <div className={`border-t py-0 bg-transparent ${className}`}>
        <div className="px-0 md:p-2 pb-1 space-y-4 bg-transparent">
          {uploadProgress.size > 0 && (
            <div className="space-y-2">
              {Array.from(uploadProgress.entries()).map(([id, progress]) => (
                <FileUploadItem
                  key={id}
                  file={{ name: progress.fileName } as File}
                  progress={progress.progress}
                  onCancel={() => {
                    setUploadProgress(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(id);
                      return newMap;
                    });
                  }}
                />
              ))}
            </div>
          )}

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {attachments.map((attachment, index) => (
                <AttachmentPreview
                  key={index}
                  attachment={attachment}
                  onRemove={() => removeAttachment(index)}
                />
              ))}
            </div>
          )}

          {/* Input area */}
          {showVoiceComposer ? (
            <div className="mb-1 flex justify-center">
              <VoiceComposer
                state={voiceState}
                transcript={voiceTranscript}
                transcriptMode={voiceTranscriptMode}
                showTranscriptPreview={voiceShowTranscriptPreview}
                attachment={voiceDraft?.attachment ?? null}
                durationMs={voiceDurationMs}
                audioLevel={voiceAudioLevel}
                countdownMs={voiceCountdownMs}
                autoSendDelayMs={voiceAutoSendDelayMs}
                isAutoSendActive={isVoiceAutoSendActive}
                reviewMode={voiceReviewMode}
                errorMessage={voiceError}
                disabled={disabled || isGenerating}
                labels={config?.labels}
                onStart={() => {
                  void startVoiceCapture();
                }}
                onStop={() => {
                  void stopVoiceCapture();
                }}
                onPauseReview={() => {
                  void pauseVoiceReview();
                }}
                onCancelAutoSend={() => {
                  cancelVoiceAutoSend();
                }}
                onDiscard={() => {
                  void cancelVoiceCapture();
                }}
                onRecordAgain={() => {
                  void startVoiceCapture(true);
                }}
                onSendNow={sendVoiceDraft}
                onExit={() => {
                  void closeVoiceComposer();
                }}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mb-1 flex justify-center">
              <div
                className="flex  items-end gap-2 p-3 border rounded-lg bg-background w-full md:min-w-3xl max-w-3xl"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {/* File upload */}
                {enableFileUpload && canAddMoreAttachments && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={acceptedFileTypes.length > 0 ? acceptedFileTypes.join(',') : undefined}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          disabled={disabled}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{config?.labels?.attachFileTooltip}</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* Text input */}
                <div className="relative flex-1">
                  <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                      onChange(e.target.value);
                      syncMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
                    }}
                    onSelect={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      syncMentionState(target.value, target.selectionStart ?? target.value.length);
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      syncMentionState(target.value, target.selectionStart ?? target.value.length);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    rows={1}
                  />
                  {isMentionMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-md border bg-popover shadow-md">
                      <div className="p-1">
                        {filteredMentionAgents.map((agent, index) => (
                          <button
                            key={agent.id}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm ${
                              index === activeMentionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                            }`}
                            onMouseDown={(mouseEvent) => {
                              mouseEvent.preventDefault();
                              selectMentionAgent(agent);
                            }}
                          >
                            <span className="font-medium">{agent.name}</span>
                            {agent.description && (
                              <span className="truncate text-xs text-muted-foreground">
                                {agent.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Voice compose entry */}
                {enableAudioRecording && canAddMoreAttachments && !value.trim() && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => {
                          void startVoiceCapture();
                        }}
                        disabled={disabled || isGenerating}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{config?.labels?.voiceEnter}</TooltipContent>
                  </Tooltip>
                )}

                {/* Submit/Stop button */}
                {isGenerating ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={onStopGeneration}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{config?.labels?.stopGenerationTooltip}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="submit"
                        size="icon"
                        className="h-10 w-10"
                        disabled={disabled || (!value.trim() && attachments.length === 0)}
                      >
                        {disabled ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{config?.labels?.sendMessageTooltip}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </form>
          )}

          {/* Help text */}
          <div className="text-[10px] text-muted-foreground text-center">
            {window.innerWidth > 768 ? config?.labels?.inputHelpText : ''}

            {attachments.length > 0 && (
              <> • {attachments.length}/{maxAttachments} anexos</>
            )}
            {config?.labels?.footerLabel && (
              <> • {config.labels.footerLabel}</>
            )}
          </div>
        </div>
      </div>
      {/* </CardContent>
      </Card> */}
    </TooltipProvider >
  );
});
