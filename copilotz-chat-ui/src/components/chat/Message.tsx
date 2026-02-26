import React, { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChatMessage, MediaAttachment, ToolCall, MessageActionEvent } from '../../types/chatTypes';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  Copy,
  Edit,
  RotateCcw,
  Check,
  X,
  Play,
  Pause,
  Wrench,
  Clock,
  ChevronRight,
  ChevronDown
} from 'lucide-react';


interface MessageProps {
  message: ChatMessage;
  isUser?: boolean;
  userAvatar?: string;
  userName?: string;
  assistantAvatar?: React.ReactNode;
  assistantName?: string;
  showTimestamp?: boolean;
  showAvatar?: boolean;
  enableCopy?: boolean;
  enableEdit?: boolean;
  enableRegenerate?: boolean;
  enableToolCallsDisplay?: boolean;
  compactMode?: boolean;
  onAction?: (event: MessageActionEvent) => void;
  className?: string;
  toolUsedLabel?: string;
  thinkingLabel?: string;
  /** When true, hides the avatar and name (for grouped consecutive messages from same sender) */
  isGrouped?: boolean;
}

// Thinking indicator component - memoized since it's rendered during streaming
const ThinkingIndicator: React.FC<{ label?: string }> = memo(function ThinkingIndicator({ label = 'Thinking...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex gap-1">
        <span 
          className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce" 
          style={{ animationDelay: '0ms' }} 
        />
        <span 
          className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce" 
          style={{ animationDelay: '150ms' }} 
        />
        <span 
          className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce" 
          style={{ animationDelay: '300ms' }} 
        />
      </div>
      <span className="text-sm text-muted-foreground animate-pulse">{label}</span>
    </div>
  );
});

// Memoized markdown components configuration to prevent recreation on every render
const markdownComponents = {
  code: ({ node, className, children, ...props }: any) => {
    const inline = (props as { inline?: boolean }).inline;
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <pre className="relative">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    ) : (
      <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    );
  },
};

// Memoized plugins arrays to prevent recreation
const remarkPluginsDefault = [remarkGfm];
const rehypePluginsDefault = [rehypeHighlight];
const rehypePluginsEmpty: never[] = [];

// Streaming text component for real-time markdown rendering - memoized to prevent unnecessary re-renders
const StreamingText: React.FC<{ content: string; isStreaming?: boolean; thinkingLabel?: string; className?: string }> = memo(function StreamingText({
  content,
  isStreaming = false,
  thinkingLabel = 'Thinking...',
  className = ''
}: { content: string; isStreaming?: boolean; thinkingLabel?: string; className?: string }) {
  const hasContent = content.trim().length > 0;

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      {hasContent ? (
        <ReactMarkdown
          remarkPlugins={remarkPluginsDefault}
          rehypePlugins={isStreaming ? rehypePluginsEmpty : rehypePluginsDefault}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      ) : isStreaming ? (
        // Show thinking indicator while waiting for first token
        <ThinkingIndicator label={thinkingLabel} />
      ) : null}
      {isStreaming && hasContent && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
      )}
    </div>
  );
});

// Media attachment renderer - memoized to prevent unnecessary re-renders
const MediaRenderer: React.FC<{ attachment: MediaAttachment }> = memo(function MediaRenderer({ attachment }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlayback = () => {
    if (attachment.kind === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (attachment.kind === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
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

  switch (attachment.kind) {
    case 'image':
      return (
        <div className="relative rounded-lg overflow-hidden border bg-muted/20 max-w-md">
          <img
            src={attachment.dataUrl}
            alt={attachment.fileName || 'Attachment'}
            className="w-full h-auto object-cover"
            loading="lazy"
          />
          {attachment.fileName && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
              {attachment.fileName}
            </div>
          )}
        </div>
      );

    case 'audio':
      return (
            <div className="flex w-full max-w-md py-0 min-w-64 items-center gap-3">
                <audio
                  ref={audioRef}
                  src={attachment.dataUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full mt-2"
                  controls
                />
            </div>
      );

    case 'video':
      return (
        <div className="relative rounded-lg overflow-hidden border bg-muted/20 max-w-lg">
          <video
            ref={videoRef}
            src={attachment.dataUrl}
            poster={attachment.poster}
            controls
            className="w-full h-auto"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
          {attachment.fileName && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
              {attachment.fileName}
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
});

// Tool calls display component - memoized to prevent unnecessary re-renders
const ToolCallsDisplay: React.FC<{ toolCalls: ToolCall[]; label?: string }> = memo(function ToolCallsDisplay({ toolCalls, label }) {
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const getStatusIcon = (status: ToolCall['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case 'running':
        return <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case 'completed':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <X className="h-3 w-3 text-destructive" />;
    }
  };

  const getStatusBadgeClasses = (status: ToolCall['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-muted text-muted-foreground';
      case 'running':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        <Wrench className="h-3 w-3" />
        {label || 'Ferramenta utilizada'}
      </div>
      {toolCalls.map((call) => {
        const isExpanded = expandedCall === call.id;
        const ToggleIcon = isExpanded ? ChevronDown : ChevronRight;

        return (
          <Card key={call.id} className="border border-dashed border-primary/40 bg-card/60">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
              onClick={() => setExpandedCall(isExpanded ? null : call.id)}
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(call.status)}
                <span className="font-medium text-sm">{call.name}</span>
                <Badge variant="secondary" className={getStatusBadgeClasses(call.status)}>
                  {call.status}
                </Badge>
              </div>
              <ToggleIcon className="h-4 w-4 text-muted-foreground" />
            </button>
            {isExpanded && (
              <CardContent className="pt-0 pb-3 px-3 text-xs space-y-2">
                <div>
                  <div className="font-medium text-muted-foreground mb-1">Args</div>
                  <pre className="rounded bg-muted p-2 overflow-x-auto text-xs">
                    {JSON.stringify(call.arguments, null, 2)}
                  </pre>
                </div>
                {typeof call.result !== 'undefined' && (
                  <div>
                    <div className="font-medium text-muted-foreground mb-1">Result</div>
                    <pre className="rounded bg-muted p-2 overflow-x-auto text-xs">
                      {JSON.stringify(call.result, null, 2)}
                    </pre>
                  </div>
                )}
                {call.startTime && call.endTime && (
                  <div className="text-muted-foreground">
                    Executed in {call.endTime - call.startTime}ms
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
});

// Keep memo comparison lightweight. Message objects are treated immutably by the
// chat state, so reference equality is enough to detect actual message changes.
const arePropsEqual = (prevProps: MessageProps, nextProps: MessageProps): boolean => {
  if (prevProps.message !== nextProps.message) return false;
  
  // Compare other props
  if (prevProps.isUser !== nextProps.isUser) return false;
  if (prevProps.userAvatar !== nextProps.userAvatar) return false;
  if (prevProps.userName !== nextProps.userName) return false;
  if (prevProps.assistantName !== nextProps.assistantName) return false;
  if (prevProps.showTimestamp !== nextProps.showTimestamp) return false;
  if (prevProps.showAvatar !== nextProps.showAvatar) return false;
  if (prevProps.enableCopy !== nextProps.enableCopy) return false;
  if (prevProps.enableEdit !== nextProps.enableEdit) return false;
  if (prevProps.enableRegenerate !== nextProps.enableRegenerate) return false;
  if (prevProps.enableToolCallsDisplay !== nextProps.enableToolCallsDisplay) return false;
  if (prevProps.compactMode !== nextProps.compactMode) return false;
  if (prevProps.className !== nextProps.className) return false;
  if (prevProps.toolUsedLabel !== nextProps.toolUsedLabel) return false;
  if (prevProps.thinkingLabel !== nextProps.thinkingLabel) return false;
  if (prevProps.isGrouped !== nextProps.isGrouped) return false;
  if (prevProps.assistantAvatar !== nextProps.assistantAvatar) return false;
  
  return true;
};

export const Message: React.FC<MessageProps> = memo(({
  message,
  isUser,
  userAvatar,
  userName = 'Você',
  assistantAvatar,
  assistantName = 'Assistente',
  showTimestamp = false,
  showAvatar = true,
  enableCopy = true,
  enableEdit = true,
  enableRegenerate = true,
  enableToolCallsDisplay = false,
  compactMode = false,
  onAction,
  className = '',
  toolUsedLabel,
  thinkingLabel = 'Thinking...',
  isGrouped = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const messageIsUser = isUser ?? message.role === 'user';
  const canEdit = enableEdit && messageIsUser;
  const canRegenerate = enableRegenerate && !messageIsUser;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onAction?.({ action: 'copy', messageId: message.id, content: message.content });
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      if (editContent.trim() !== message.content) {
        onAction?.({ action: 'edit', messageId: message.id, content: editContent.trim() });
      }
      setIsEditing(false);
    } else {
      setEditContent(message.content);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleRegenerate = () => {
    onAction?.({ action: 'regenerate', messageId: message.id });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TooltipProvider>
      <div
        className={`flex w-full flex-col ${className} max-w-[800px] mx-auto`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >

        {/* Header row with avatar and name - hidden when grouped */}
        {!isGrouped && (
          <div className={`flex gap-3 ${messageIsUser ? 'flex-row-reverse' : 'flex-row'} w-full mb-1`}>
            {/* Avatar */}
            {showAvatar && (
              <div className={`flex-shrink-0 ${compactMode ? 'mt-1' : 'mt-0'}`}>
                <Avatar className={compactMode ? 'h-6 w-6' : 'h-8 w-8'}>
                  {messageIsUser ? (
                    <>
                      <AvatarImage src={userAvatar} alt={userName} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </>
                  ) : (
                    <>
                      {assistantAvatar || (
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          AI
                        </AvatarFallback>
                      )}
                    </>
                  )}
                </Avatar>
              </div>
            )}

            {/* Header */}
            <div className={`flex items-center gap-2 mb-1 ${messageIsUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className={`font-medium ${compactMode ? 'text-sm' : 'text-base'}`}>
                {messageIsUser ? userName : assistantName}
              </span>
              {showTimestamp && (
                <span className="text-xs text-muted-foreground">
                  {formatTime(message.timestamp)}
                </span>
              )}
              {message.isEdited && (
                <Badge variant="outline" className="text-xs">
                  editado
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Add left margin for grouped messages to align with content under avatar */}
        <div className={`flex-1 min-w-0 ${messageIsUser ? 'text-right' : 'text-left'} ${isGrouped && showAvatar && !messageIsUser ? (compactMode ? 'ml-9' : 'ml-11') : ''} ${isGrouped && showAvatar && messageIsUser ? (compactMode ? 'mr-9' : 'mr-11') : ''}`}>

          {/* Message Body */}
          <div className={`relative inline-flex flex-col ${messageIsUser
            ? 'rounded-lg p-3 bg-primary text-primary-foreground ml-auto max-w-[85%]'
            : 'max-w-[85%]'
            }`}>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[100px] resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleEdit}>
                    <Check className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Tool Calls */}
                {enableToolCallsDisplay && message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mb-3">
                    <ToolCallsDisplay toolCalls={message.toolCalls} label={toolUsedLabel} />
                  </div>
                )}

                <StreamingText
                  content={message.content}
                  isStreaming={message.isStreaming}
                  thinkingLabel={thinkingLabel}
                  className={messageIsUser ? '[&_*]:text-right' : ''}
                />

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.attachments.map((attachment, index) => (
                      <MediaRenderer key={index} attachment={attachment} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            {!isEditing && (showActions || copied) && (
              <div className={`absolute -top-2 flex gap-1 ${messageIsUser ? '-left-2' : '-right-2'
                }`}>
                {enableCopy && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copied ? 'Copiado!' : 'Copiar'}
                    </TooltipContent>
                  </Tooltip>
                )}

                {canEdit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleEdit}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Editar
                    </TooltipContent>
                  </Tooltip>
                )}

                {canRegenerate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleRegenerate}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Regenerar
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}, arePropsEqual);
