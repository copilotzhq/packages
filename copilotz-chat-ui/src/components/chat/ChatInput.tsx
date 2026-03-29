import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useChatUserContext } from './UserContext';
import {
  MediaAttachment,
  FileUploadProgress,
  ChatConfig,
  VoiceComposerState,
  VoiceProvider,
  VoiceSegment,
  VoiceTranscript,
} from '../../types/chatTypes';
import { createObjectUrlFromDataUrl } from '../../lib/utils';
import { resolveVoiceProviderFactory } from '../../lib/voiceCompose';
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
              alt={attachment.fileName || 'Anexo'}
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
                {attachment.fileName || 'Áudio'}
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

        {attachment.fileName && attachment.kind !== 'audio' && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b">
            <p className="truncate">{attachment.fileName}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// Audio recording component - memoized
const AudioRecorder: React.FC<{
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancel: () => void;
  recordingDuration: number;
  config?: ChatConfig;
}> = memo(function AudioRecorder({ isRecording, onStartRecording, onStopRecording, onCancel, recordingDuration, config }) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onStartRecording}
            className="h-10 w-10"
          >
            <Mic className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{config?.labels?.recordAudioTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              Gravando
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {formatTime(recordingDuration)}
          </Badge>
          <div className="flex gap-1 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onStopRecording}
            >
              <Square className="h-3 w-3 mr-1" />
              Parar
            </Button>
          </div>
        </div>
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

export const ChatInput: React.FC<ChatInputProps> = memo(function ChatInput({
  value,
  onChange,
  onSubmit,
  attachments,
  onAttachmentsChange,
  placeholder = 'Digite sua mensagem...',
  disabled = false,
  isGenerating = false,
  onStopGeneration,
  enableFileUpload = true,
  enableAudioRecording = true,
  maxAttachments = 4,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = ['image/*', 'video/*', 'audio/*'],
  className = '',
  config,
}: ChatInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const { setContext } = useChatUserContext();
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Map<string, FileUploadProgress>>(new Map());
  const [isVoiceComposerOpen, setIsVoiceComposerOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceComposerState>('idle');
  const [voiceDraft, setVoiceDraft] = useState<VoiceSegment | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<VoiceTranscript>(clearVoiceTranscript);
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [voiceAudioLevel, setVoiceAudioLevel] = useState(0);
  const [voiceCountdownMs, setVoiceCountdownMs] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTime = useRef<number>(0);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);

  const voiceComposeEnabled = config?.voiceCompose?.enabled === true;
  const voiceAutoSendDelayMs = config?.voiceCompose?.autoSendDelayMs ?? 5000;
  const voicePersistComposer = config?.voiceCompose?.persistComposer ?? true;
  const voiceShowTranscriptPreview = config?.voiceCompose?.showTranscriptPreview ?? true;
  const voiceTranscriptMode = config?.voiceCompose?.transcriptMode ?? 'final-only';
  const voiceMaxRecordingMs = config?.voiceCompose?.maxRecordingMs;

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
      if (voiceProviderRef.current) {
        void voiceProviderRef.current.destroy();
        voiceProviderRef.current = null;
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!value.trim() && attachments.length === 0) || disabled || isGenerating) return;

    onSubmit(value.trim(), attachments);
    onChange('');
    onAttachmentsChange([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && window.innerWidth > 768) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const processFile = async (file: File): Promise<MediaAttachment | null> => {
    if (file.size > maxFileSize) {
      alert(`Arquivo muito grande. Máximo permitido: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
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
        kind: file.type.startsWith('image/') ? 'image' :
          file.type.startsWith('video/') ? 'video' :
            file.type.startsWith('audio/') ? 'audio' : 'image',
        dataUrl,
        mimeType: file.type,
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
      alert('Erro ao processar arquivo');
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const attachment: MediaAttachment = {
          kind: 'audio',
          dataUrl,
          mimeType: blob.type,
          durationMs: recordingDuration * 1000,
          fileName: `audio_${new Date().toISOString().slice(0, 19)}.webm`,
          size: blob.size,
        };

        onAttachmentsChange([...attachments, attachment]);

        // Cleanup
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      };

      recordingStartTime.current = Date.now();
      setRecordingDuration(0);
      setIsRecording(true);
      mediaRecorder.start();

      recordingInterval.current = setInterval(() => {
        const duration = Math.floor((Date.now() - recordingStartTime.current) / 1000);
        setRecordingDuration(duration);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
      // Don't process the recording
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const resetVoiceComposerState = useCallback((nextState: VoiceComposerState = 'idle') => {
    setVoiceState(nextState);
    setVoiceDraft(null);
    setVoiceTranscript(clearVoiceTranscript());
    setVoiceDurationMs(0);
    setVoiceAudioLevel(0);
    setVoiceCountdownMs(0);
    setVoiceError(null);
  }, []);

  const ensureVoiceProvider = useCallback(async () => {
    if (voiceProviderRef.current) {
      return voiceProviderRef.current;
    }

    const createProvider = resolveVoiceProviderFactory(config?.voiceCompose?.createProvider);
    const provider = await createProvider({
      onStateChange: setVoiceState,
      onAudioLevelChange: setVoiceAudioLevel,
      onDurationChange: setVoiceDurationMs,
      onTranscriptChange: setVoiceTranscript,
      onSegmentReady: (segment) => {
        setVoiceDraft(segment);
        setVoiceTranscript(segment.transcript ?? clearVoiceTranscript());
        setVoiceDurationMs(segment.attachment.durationMs ?? 0);
        setVoiceAudioLevel(0);
        setVoiceCountdownMs(voiceAutoSendDelayMs);
        setVoiceError(null);
        setVoiceState('review');
      },
      onError: (error) => {
        setVoiceError(resolveVoiceErrorMessage(error, config));
        setVoiceAudioLevel(0);
        setVoiceCountdownMs(0);
        setVoiceState('error');
      },
    }, {
      maxRecordingMs: voiceMaxRecordingMs,
    });

    voiceProviderRef.current = provider;
    return provider;
  }, [config, voiceAutoSendDelayMs, voiceMaxRecordingMs]);

  const closeVoiceComposer = useCallback(async () => {
    setIsVoiceComposerOpen(false);
    setVoiceError(null);
    setVoiceCountdownMs(0);
    setVoiceAudioLevel(0);
    setVoiceTranscript(clearVoiceTranscript());
    setVoiceDraft(null);
    setVoiceDurationMs(0);
    setVoiceState('idle');

    if (voiceProviderRef.current) {
      await voiceProviderRef.current.cancel();
    }
  }, []);

  const startVoiceCapture = useCallback(async () => {
    if (disabled || isGenerating) {
      return;
    }

    setIsVoiceComposerOpen(true);
    setVoiceError(null);
    setVoiceDraft(null);
    setVoiceCountdownMs(0);
    setVoiceTranscript(clearVoiceTranscript());
    setVoiceAudioLevel(0);
    setVoiceDurationMs(0);

    try {
      const provider = await ensureVoiceProvider();
      await provider.start();
    } catch (error) {
      setVoiceError(resolveVoiceErrorMessage(error, config));
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
    if (!voiceDraft || disabled || isGenerating) {
      return;
    }

    setVoiceState('sending');
    setVoiceCountdownMs(0);
    onSubmit('', [...attachments, voiceDraft.attachment]);
    onChange('');
    onAttachmentsChange([]);
    finalizeVoiceComposerAfterSend();
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

  const recordVoiceAgain = useCallback(async () => {
    resetVoiceComposerState('idle');
    await startVoiceCapture();
  }, [resetVoiceComposerState, startVoiceCapture]);

  useEffect(() => {
    if (voiceState !== 'review' || !voiceDraft || voiceAutoSendDelayMs <= 0) {
      return;
    }

    const startedAt = Date.now();
    setVoiceCountdownMs(voiceAutoSendDelayMs);

    const timer = setInterval(() => {
      const remaining = Math.max(0, voiceAutoSendDelayMs - (Date.now() - startedAt));
      setVoiceCountdownMs(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        sendVoiceDraft();
      }
    }, 100);

    return () => clearInterval(timer);
  }, [voiceState, voiceDraft, voiceAutoSendDelayMs, sendVoiceDraft]);

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  const canAddMoreAttachments = attachments.length < maxAttachments;
  const showVoiceComposer = voiceComposeEnabled && isVoiceComposerOpen;

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

          {/* Audio recording */}
          {isRecording && (
            <AudioRecorder
              isRecording={isRecording}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onCancel={cancelRecording}
              recordingDuration={recordingDuration}
              config={config}
            />
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
                durationMs={voiceDurationMs}
                audioLevel={voiceAudioLevel}
                countdownMs={voiceCountdownMs}
                autoSendDelayMs={voiceAutoSendDelayMs}
                errorMessage={voiceError}
                disabled={disabled || isGenerating}
                labels={config?.labels}
                onStart={() => {
                  void startVoiceCapture();
                }}
                onStop={() => {
                  void stopVoiceCapture();
                }}
                onCancel={() => {
                  void cancelVoiceCapture();
                }}
                onSendNow={sendVoiceDraft}
                onRecordAgain={() => {
                  void recordVoiceAgain();
                }}
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
                      accept={acceptedFileTypes.join(',')}
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
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    rows={1}
                  />
                </div>

                {/* Audio recording / voice compose entry */}
                {enableAudioRecording && !isRecording && canAddMoreAttachments && !value.trim() && (
                  voiceComposeEnabled ? (
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
                      <TooltipContent>{config?.labels?.voiceEnter || config?.labels?.recordAudioTooltip}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <AudioRecorder
                      isRecording={isRecording}
                      onStartRecording={startRecording}
                      onStopRecording={stopRecording}
                      onCancel={cancelRecording}
                      recordingDuration={recordingDuration}
                      config={config}
                    />
                  )
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
