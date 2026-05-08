import React, { useState, useMemo, useEffect, memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChatConfig, ChatMarkdownConfig, ChatMessage, MediaAttachment, MessageActionEvent } from '../../types/chatTypes';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { createObjectUrlFromDataUrl } from '../../lib/utils';
import { AssistantActivity } from './AssistantActivity';
import { MessageSenderAvatar, resolveMessageSenderDisplay } from './MessageSender';
import {
  Copy,
  Edit,
  RotateCcw,
  Check,
  X,
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
  showActivity?: boolean;
  showActivityDetails?: boolean;
  compactMode?: boolean;
  onAction?: (event: MessageActionEvent) => void;
  className?: string;
  labels?: ChatConfig['labels'];
  showMoreLabel?: string;
  showLessLabel?: string;
  collapseLongMessages?: boolean;
  collapseLongMessagesForUserOnly?: boolean;
  longMessagePreviewChars?: number;
  longMessageChunkChars?: number;
  renderUserMarkdown?: boolean;
  markdown?: ChatMarkdownConfig;
  isExpanded?: boolean;
  onToggleExpanded?: (messageId: string) => void;
}

const hasRenderableAssistantBody = (message: ChatMessage): boolean => {
  if (message.role !== 'assistant') return true;
  if (typeof message.content === 'string' && message.content.trim().length > 0) return true;
  if (Array.isArray(message.attachments) && message.attachments.length > 0) return true;
  return Boolean(message.activity?.items.length);
};

// Memoized markdown components configuration to prevent recreation on every render
const defaultMarkdownComponents: Components = {
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
const remarkPluginsDefault = [remarkGfm] as NonNullable<ChatMarkdownConfig['remarkPlugins']>;
const rehypePluginsDefault = [rehypeHighlight] as NonNullable<ChatMarkdownConfig['rehypePlugins']>;
const rehypePluginsEmpty = [] as NonNullable<ChatMarkdownConfig['rehypePlugins']>;

const getPlainTextChunks = (content: string, chunkSize: number): string[] => {
  if (chunkSize <= 0 || content.length <= chunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    let end = Math.min(start + chunkSize, content.length);

    if (end < content.length) {
      const splitAt = content.lastIndexOf('\n', end);
      if (splitAt > start + Math.floor(chunkSize / 2)) {
        end = splitAt + 1;
      }
    }

    chunks.push(content.slice(start, end));
    start = end;
  }

  return chunks;
};

const hasCodeBlocks = (content: string): boolean => /(^|\n)(```|~~~)/.test(content);

const getCollapsedPreview = (content: string, previewChars: number, previewOverride?: string): string => {
  if (previewOverride && previewOverride.trim().length > 0) {
    const normalizedPreview = previewOverride.trimEnd();
    return normalizedPreview.endsWith('...') ? normalizedPreview : `${normalizedPreview}...`;
  }

  if (content.length <= previewChars) {
    return content;
  }

  return `${content.slice(0, previewChars).trimEnd()}...`;
};

const LongContentShell: React.FC<{
  children: React.ReactNode;
  className: string;
  style?: React.CSSProperties;
}> = memo(function LongContentShell({ children, className, style }) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
});

const PlainTextContent: React.FC<{
  content: string;
  className?: string;
  chunkSize?: number;
  style?: React.CSSProperties;
}> = memo(function PlainTextContent({
  content,
  className = '',
  chunkSize = 12000,
  style,
}) {
  const chunks = useMemo(() => getPlainTextChunks(content, chunkSize), [content, chunkSize]);

  return (
    <LongContentShell
      className={`text-sm leading-6 whitespace-pre-wrap break-words ${className}`.trim()}
      style={style}
    >
      {chunks.map((chunk, index) => (
        <React.Fragment key={index}>{chunk}</React.Fragment>
      ))}
    </LongContentShell>
  );
});

// Streaming text component for real-time markdown rendering - memoized to prevent unnecessary re-renders
const StreamingText: React.FC<{
  content: string;
  isStreaming?: boolean;
  className?: string;
  renderMarkdown?: boolean;
  markdown?: ChatMarkdownConfig;
  plainTextChunkChars?: number;
}> = memo(function StreamingText({
  content,
  isStreaming = false,
  className = '',
  renderMarkdown = true,
  markdown,
  plainTextChunkChars = 12000,
}: {
  content: string;
  isStreaming?: boolean;
  className?: string;
  renderMarkdown?: boolean;
  markdown?: ChatMarkdownConfig;
  plainTextChunkChars?: number;
}) {
  const hasContent = content.trim().length > 0;
  const enableSyntaxHighlight = renderMarkdown && !isStreaming && hasCodeBlocks(content);
  const mergedComponents = useMemo<Components>(
    () => ({
      ...defaultMarkdownComponents,
      ...markdown?.components,
    }),
    [markdown?.components],
  );
  const mergedRemarkPlugins = useMemo<NonNullable<ChatMarkdownConfig['remarkPlugins']>>(
    () => [
      ...remarkPluginsDefault,
      ...(markdown?.remarkPlugins ?? []),
    ],
    [markdown?.remarkPlugins],
  );
  const mergedRehypePlugins = useMemo<NonNullable<ChatMarkdownConfig['rehypePlugins']>>(
    () => [
      ...(enableSyntaxHighlight ? rehypePluginsDefault : rehypePluginsEmpty),
      ...(markdown?.rehypePlugins ?? []),
    ],
    [enableSyntaxHighlight, markdown?.rehypePlugins],
  );

  return (
    <>
      {hasContent ? (
        renderMarkdown ? (
          <LongContentShell
            className={`prose prose-sm max-w-none dark:prose-invert break-words ${className}`.trim()}
          >
            <ReactMarkdown
              remarkPlugins={mergedRemarkPlugins}
              rehypePlugins={mergedRehypePlugins}
              components={mergedComponents}
            >
              {content}
            </ReactMarkdown>
          </LongContentShell>
        ) : (
          <PlainTextContent
            content={content}
            className={className}
            chunkSize={plainTextChunkChars}
          />
        )
      ) : null}
      {isStreaming && hasContent && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
      )}
    </>
  );
});

// Media attachment renderer - memoized to prevent unnecessary re-renders
const MediaRenderer: React.FC<{ attachment: MediaAttachment }> = memo(function MediaRenderer({ attachment }) {
  const [audioPlaybackSrc, setAudioPlaybackSrc] = useState(attachment.dataUrl);

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
                  className="w-full mt-2"
                  preload="metadata"
                  controls
                >
                  <source src={audioPlaybackSrc} type={attachment.mimeType} />
                </audio>
            </div>
      );

    case 'video':
      return (
        <div className="relative rounded-lg overflow-hidden border bg-muted/20 max-w-lg">
          <video
            src={attachment.dataUrl}
            poster={attachment.poster}
            controls
            className="w-full h-auto"
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
  if (prevProps.showActivity !== nextProps.showActivity) return false;
  if (prevProps.showActivityDetails !== nextProps.showActivityDetails) return false;
  if (prevProps.compactMode !== nextProps.compactMode) return false;
  if (prevProps.className !== nextProps.className) return false;
  if (prevProps.labels !== nextProps.labels) return false;
  if (prevProps.showMoreLabel !== nextProps.showMoreLabel) return false;
  if (prevProps.showLessLabel !== nextProps.showLessLabel) return false;
  if (prevProps.collapseLongMessages !== nextProps.collapseLongMessages) return false;
  if (prevProps.collapseLongMessagesForUserOnly !== nextProps.collapseLongMessagesForUserOnly) return false;
  if (prevProps.longMessagePreviewChars !== nextProps.longMessagePreviewChars) return false;
  if (prevProps.longMessageChunkChars !== nextProps.longMessageChunkChars) return false;
  if (prevProps.renderUserMarkdown !== nextProps.renderUserMarkdown) return false;
  if (prevProps.markdown !== nextProps.markdown) return false;
  if (prevProps.isExpanded !== nextProps.isExpanded) return false;
  if (prevProps.onToggleExpanded !== nextProps.onToggleExpanded) return false;
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
  showActivity = true,
  showActivityDetails = true,
  compactMode = false,
  onAction,
  className = '',
  labels,
  showMoreLabel = 'Show more',
  showLessLabel = 'Show less',
  collapseLongMessages = false,
  collapseLongMessagesForUserOnly = false,
  longMessagePreviewChars = 4000,
  longMessageChunkChars = 12000,
  renderUserMarkdown = true,
  markdown,
  isExpanded = false,
  onToggleExpanded,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const messageIsUser = isUser ?? message.role === 'user';
  if (!hasRenderableAssistantBody(message)) {
    return null;
  }

  const senderDisplay = resolveMessageSenderDisplay({
    sender: message.sender,
    fallbackName: messageIsUser ? userName : assistantName,
    fallbackAvatar: messageIsUser ? undefined : assistantAvatar,
    fallbackAvatarUrl: messageIsUser ? userAvatar : undefined,
    compactMode,
  });
  const canEdit = enableEdit && messageIsUser;
  const canRegenerate = enableRegenerate && !messageIsUser;
  const normalizedPreviewChars = Math.max(longMessagePreviewChars, 1);
  const normalizedChunkChars = Math.max(longMessageChunkChars, 1);
  const previewOverride = typeof message.metadata?.previewContent === 'string'
    ? message.metadata.previewContent
    : undefined;
  const canCollapseMessage = collapseLongMessages
    && !message.isStreaming
    && message.content.length > normalizedPreviewChars
    && (!collapseLongMessagesForUserOnly || messageIsUser);
  const isCollapsed = canCollapseMessage && !isExpanded;
  const contentToRender = isCollapsed
    ? getCollapsedPreview(message.content, normalizedPreviewChars, previewOverride)
    : message.content;
  const shouldRenderMarkdown = !isCollapsed && (!messageIsUser || renderUserMarkdown);

  const horizontalOffsetClass = showAvatar
    ? messageIsUser
      ? (compactMode ? 'mr-9' : 'mr-11')
      : (compactMode ? 'ml-9' : 'ml-11')
    : '';

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

  const handleToggleExpanded = () => {
    onToggleExpanded?.(message.id);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
      <div
        className={`flex w-full flex-col ${className} max-w-[800px] mx-auto`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >

        <div className={`flex gap-3 ${messageIsUser ? 'flex-row-reverse' : 'flex-row'} w-full mb-1`}>
          {showAvatar && (
            <div className={`flex-shrink-0 ${compactMode ? 'mt-1' : 'mt-0'}`}>
              <MessageSenderAvatar
                sender={message.sender}
                fallbackName={messageIsUser ? userName : assistantName}
                fallbackAvatar={messageIsUser ? undefined : assistantAvatar}
                fallbackAvatarUrl={messageIsUser ? userAvatar : undefined}
                compactMode={compactMode}
              />
            </div>
          )}

          <div className={`flex items-center gap-2 mb-1 ${messageIsUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span
              className={`font-medium ${compactMode ? 'text-sm' : 'text-base'}`}
              style={!messageIsUser && senderDisplay.color ? { color: senderDisplay.color } : undefined}
            >
              {senderDisplay.name}
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

        {/* Keep body alignment consistent across grouped and ungrouped messages */}
        <div className={`flex-1 min-w-0 ${messageIsUser ? 'text-right' : 'text-left'} ${horizontalOffsetClass}`}>

          {/* Message Body */}
          <div className={`relative overflow-hidden text-left ${messageIsUser
            ? 'ml-auto inline-flex max-w-[85%] flex-col rounded-lg bg-primary p-3 text-primary-foreground'
            : 'flex w-full max-w-full flex-col'
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
                {!messageIsUser && (
                  <AssistantActivity
                    activity={message.activity}
                    showActivity={showActivity}
                    showActivityDetails={showActivityDetails}
                    labels={labels}
                  />
                )}

                <StreamingText
                  content={contentToRender}
                  isStreaming={message.isStreaming}
                  renderMarkdown={shouldRenderMarkdown}
                  markdown={markdown}
                  plainTextChunkChars={normalizedChunkChars}
                />

                {canCollapseMessage && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 text-xs font-medium text-current hover:bg-transparent hover:opacity-80"
                      aria-expanded={!isCollapsed}
                      onClick={handleToggleExpanded}
                    >
                      {isCollapsed ? showMoreLabel : showLessLabel}
                    </Button>
                  </div>
                )}

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
  );
}, arePropsEqual);
