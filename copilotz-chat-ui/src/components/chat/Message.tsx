import React, { useState, useMemo, useEffect, memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { AgentOption, ChatConfig, ChatMarkdownConfig, ChatMessage, MediaAttachment, MessageActionEvent, ToolCallDraftSource, ToolRendererMap } from '../../types/chatTypes';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { createObjectUrlFromDataUrl, formatFileSize } from '../../lib/utils';
import { joinMessageGroupContent } from '../../lib/messageGrouping';
import { AssistantActivity } from './AssistantActivity';
import { MessageSenderAvatar, resolveMessageSenderDisplay } from './MessageSender';
import {
  Copy,
  Edit,
  Check,
  X,
  Download,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
} from 'lucide-react';


interface MessageProps {
  message: ChatMessage;
  fragments?: ChatMessage[];
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
  toolRenderers?: ToolRendererMap;
  toolCallDraftSource?: ToolCallDraftSource;
  agents?: readonly AgentOption[];
}

const hasRenderableAssistantBody = (message: ChatMessage): boolean => {
  if (message.role !== 'assistant') return true;
  if (typeof message.content === 'string' && message.content.trim().length > 0) return true;
  if (Array.isArray(message.attachments) && message.attachments.length > 0) return true;
  return Boolean(message.activity?.items.length);
};

const filterActivity = (
  message: ChatMessage,
  placement: 'before-content' | 'after-content',
): ChatMessage['activity'] => {
  const items = message.activity?.items.filter((item) => (
    placement === 'after-content' ? item.kind === 'tool' : item.kind !== 'tool'
  )) ?? [];
  return items.length > 0 ? { items } : undefined;
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

const getAttachmentLabel = (attachment: MediaAttachment) =>
  attachment.fileName || attachment.mimeType || 'Attachment';

const getAttachmentIcon = (attachment: MediaAttachment) => {
  if (attachment.kind === 'image') return FileImage;
  if (attachment.kind === 'audio') return FileAudio;
  if (attachment.kind === 'video') return FileVideo;

  const value = `${attachment.fileName || ''} ${attachment.mimeType || ''}`.toLowerCase();
  if (value.includes('zip') || value.includes('gzip') || value.includes('tar') || value.includes('archive')) {
    return FileArchive;
  }
  if (value.includes('json') || value.includes('text') || value.includes('markdown') || value.includes('csv')) {
    return FileText;
  }
  return File;
};

const AttachmentDownloadButton: React.FC<{ attachment: MediaAttachment }> = ({ attachment }) => (
  <Button asChild size="sm">
    <a href={attachment.dataUrl} download={attachment.fileName || 'attachment'}>
      <Download className="h-4 w-4" />
      Download
    </a>
  </Button>
);

const AttachmentMetadata: React.FC<{ attachment: MediaAttachment }> = ({ attachment }) => (
  <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
    <dt className="text-muted-foreground">Type</dt>
    <dd className="min-w-0 truncate">{attachment.mimeType || 'application/octet-stream'}</dd>
    {attachment.fileName && (
      <>
        <dt className="text-muted-foreground">Name</dt>
        <dd className="min-w-0 truncate">{attachment.fileName}</dd>
      </>
    )}
    {typeof attachment.size === 'number' && (
      <>
        <dt className="text-muted-foreground">Size</dt>
        <dd>{formatFileSize(attachment.size)}</dd>
      </>
    )}
  </dl>
);

const FileAttachmentCard: React.FC<{ attachment: MediaAttachment; compact?: boolean }> = ({ attachment, compact = false }) => {
  const Icon = getAttachmentIcon(attachment);
  const size = formatFileSize(attachment.size);

  return (
    <div className={`flex w-full min-w-0 max-w-md items-center gap-3 rounded-lg border bg-muted/20 text-left ${compact ? 'p-2' : 'p-3'}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{getAttachmentLabel(attachment)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[attachment.mimeType || 'File', size].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
};

const AttachmentDialog: React.FC<{
  attachment: MediaAttachment;
  children: React.ReactNode;
}> = ({ attachment, children }) => {
  const label = getAttachmentLabel(attachment);
  const Icon = getAttachmentIcon(attachment);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[min(calc(100vw-2rem),48rem)] max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="min-w-0 truncate">{label}</DialogTitle>
          <DialogDescription className="min-w-0 truncate">Attachment details and download options.</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
          {attachment.kind === 'image' ? (
            <div className="max-h-[65vh] min-w-0 overflow-auto rounded-lg border bg-muted/20">
              <img
                src={attachment.dataUrl}
                alt={label}
                className="mx-auto h-auto max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>
          ) : attachment.kind === 'video' ? (
            <div className="min-w-0 rounded-lg border bg-muted/20">
              <video
                src={attachment.dataUrl}
                poster={attachment.poster}
                controls
                className="max-h-[65vh] w-full rounded-lg"
              />
            </div>
          ) : attachment.kind === 'audio' ? (
            <audio className="w-full" preload="metadata" controls>
              <source src={attachment.dataUrl} type={attachment.mimeType} />
            </audio>
          ) : (
            <div className="flex min-w-0 flex-col items-center gap-3 rounded-lg border bg-muted/20 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-8 w-8 text-foreground" />
              </div>
              <p className="w-full min-w-0 truncate text-sm font-medium">{label}</p>
            </div>
          )}
          <AttachmentMetadata attachment={attachment} />
        </div>
        <DialogFooter className="min-w-0">
          <AttachmentDownloadButton attachment={attachment} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
        <AttachmentDialog attachment={attachment}>
          <button type="button" className="block max-w-md text-left">
            <div className="relative overflow-hidden rounded-lg border bg-muted/20">
              <img
                src={attachment.dataUrl}
                alt={attachment.fileName || 'Attachment'}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
              {attachment.fileName && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-xs text-white">
                  {attachment.fileName}
                </div>
              )}
            </div>
          </button>
        </AttachmentDialog>
      );

    case 'audio':
      return (
        <div className="flex w-full max-w-md min-w-64 items-center gap-2 py-0">
          <audio
            className="mt-2 w-full"
            preload="metadata"
            controls
          >
            <source src={audioPlaybackSrc} type={attachment.mimeType} />
          </audio>
          <AttachmentDialog attachment={attachment}>
            <Button type="button" variant="outline" size="icon" className="mt-2 shrink-0">
              <FileAudio className="h-4 w-4" />
            </Button>
          </AttachmentDialog>
        </div>
      );

    case 'video':
      return (
        <AttachmentDialog attachment={attachment}>
          <button type="button" className="block max-w-lg text-left">
            <div className="relative overflow-hidden rounded-lg border bg-muted/20">
              <video
                src={attachment.dataUrl}
                poster={attachment.poster}
                className="h-auto w-full"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <FileVideo className="h-8 w-8 rounded-full bg-black/50 p-1.5 text-white" />
              </div>
              {attachment.fileName && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-xs text-white">
                  {attachment.fileName}
                </div>
              )}
            </div>
          </button>
        </AttachmentDialog>
      );

    case 'file':
      return (
        <AttachmentDialog attachment={attachment}>
          <button type="button" className="block w-full max-w-md text-left">
            <FileAttachmentCard attachment={attachment} />
          </button>
        </AttachmentDialog>
      );

    default:
      return null;
  }
});

// Keep memo comparison lightweight. Message objects are treated immutably by the
// chat state, so reference equality is enough to detect actual message changes.
const arePropsEqual = (prevProps: MessageProps, nextProps: MessageProps): boolean => {
  if (prevProps.message !== nextProps.message) return false;
  if (prevProps.fragments !== nextProps.fragments) return false;
  
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
  if (prevProps.toolRenderers !== nextProps.toolRenderers) return false;
  if (prevProps.toolCallDraftSource !== nextProps.toolCallDraftSource) return false;
  if (prevProps.agents !== nextProps.agents) return false;
  
  return true;
};

export const Message: React.FC<MessageProps> = memo(({
  message,
  fragments,
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
  toolRenderers,
  toolCallDraftSource,
  agents,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [actionsFocused, setActionsFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  const sourceMessages = fragments?.length ? fragments : [message];
  const headerMessage = sourceMessages[0];
  const groupContent = joinMessageGroupContent(sourceMessages);
  const messageIsUser = isUser ?? message.role === 'user';
  if (!sourceMessages.some(hasRenderableAssistantBody)) {
    return null;
  }

  const senderDisplay = resolveMessageSenderDisplay({
    sender: headerMessage.sender,
    fallbackName: messageIsUser ? userName : assistantName,
    fallbackAvatar: messageIsUser ? undefined : assistantAvatar,
    fallbackAvatarUrl: messageIsUser ? userAvatar : undefined,
    compactMode,
  });
  const canEdit = enableEdit && messageIsUser;
  const normalizedPreviewChars = Math.max(longMessagePreviewChars, 1);
  const normalizedChunkChars = Math.max(longMessageChunkChars, 1);
  const previewOverride = typeof message.metadata?.previewContent === 'string'
    ? message.metadata.previewContent
    : undefined;
  const canCollapseMessage = collapseLongMessages
    && sourceMessages.length === 1
    && !sourceMessages.some((sourceMessage) => sourceMessage.isStreaming)
    && groupContent.length > normalizedPreviewChars
    && (!collapseLongMessagesForUserOnly || messageIsUser);
  const isCollapsed = canCollapseMessage && !isExpanded;
  const contentToRender = isCollapsed
    ? getCollapsedPreview(groupContent, normalizedPreviewChars, previewOverride)
    : groupContent;
  const shouldRenderMarkdown = !isCollapsed && (!messageIsUser || renderUserMarkdown);

  const horizontalOffsetClass = showAvatar
    ? messageIsUser
      ? (compactMode ? 'mr-9' : 'mr-11')
      : (compactMode ? 'ml-9' : 'ml-11')
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(groupContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onAction?.({ action: 'copy', messageId: message.id, content: groupContent });
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
        onFocusCapture={() => setActionsFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setActionsFocused(false);
          }
        }}
      >

        <div className={`flex gap-3 ${messageIsUser ? 'flex-row-reverse' : 'flex-row'} w-full mb-1`}>
          {showAvatar && (
            <div className={`flex-shrink-0 ${compactMode ? 'mt-1' : 'mt-0'}`}>
              <MessageSenderAvatar
                sender={headerMessage.sender}
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
                {formatTime(headerMessage.timestamp)}
              </span>
            )}
            {sourceMessages.some((sourceMessage) => sourceMessage.isEdited) && (
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
            ? isEditing
              ? 'ml-auto flex w-full max-w-[min(42rem,85%)] flex-col rounded-xl border bg-background p-2 text-foreground shadow-sm'
              : 'ml-auto inline-flex max-w-[85%] flex-col rounded-lg bg-primary p-3 text-primary-foreground'
            : 'flex w-full max-w-full flex-col'
            }`}>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-28 resize-y bg-muted/30 text-sm leading-6"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4 mr-1" />
                    {labels?.cancel || 'Cancel'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={handleEdit}
                    disabled={!editContent.trim() || editContent.trim() === message.content}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {sourceMessages.map((sourceMessage) => {
                  const beforeContentActivity = filterActivity(sourceMessage, 'before-content');
                  const afterContentActivity = filterActivity(sourceMessage, 'after-content');
                  const fragmentContent = sourceMessages.length === 1
                    ? contentToRender
                    : sourceMessage.content;

                  return (
                    <React.Fragment key={sourceMessage.id}>
                      {!messageIsUser && (
                        <AssistantActivity
                          activity={beforeContentActivity}
                          showActivity={showActivity}
                          showActivityDetails={showActivityDetails}
                          labels={labels}
                          toolRenderers={toolRenderers}
                          toolCallDraftSource={toolCallDraftSource}
                          agents={agents}
                        />
                      )}

                      {fragmentContent.length > 0 && (
                        <StreamingText
                          content={fragmentContent}
                          isStreaming={sourceMessage.isStreaming}
                          renderMarkdown={shouldRenderMarkdown}
                          markdown={markdown}
                          plainTextChunkChars={normalizedChunkChars}
                        />
                      )}

                      {!messageIsUser && (
                        <AssistantActivity
                          activity={afterContentActivity}
                          showActivity={showActivity}
                          showActivityDetails={showActivityDetails}
                          labels={labels}
                          toolRenderers={toolRenderers}
                          toolCallDraftSource={toolCallDraftSource}
                          agents={agents}
                        />
                      )}

                      {sourceMessage.attachments && sourceMessage.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {sourceMessage.attachments.map((attachment, index) => (
                            <MediaRenderer key={`${sourceMessage.id}:${index}`} attachment={attachment} />
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

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

              </>
            )}

            {/* Action Buttons */}
          </div>

          {!isEditing && (enableCopy || canEdit) && (
            <div
              className={`mt-1 flex h-7 items-center gap-1 text-muted-foreground transition-opacity duration-150 ${
                messageIsUser ? 'justify-end' : 'justify-start'
              } ${
                showActions || actionsFocused || copied
                  ? 'opacity-100'
                  : 'pointer-events-none opacity-0'
              }`}
            >
              {canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleEdit}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {labels?.editMessage || 'Edit'}
                  </TooltipContent>
                </Tooltip>
              )}

              {enableCopy && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copied ? 'Copied' : labels?.copyMessage || 'Copy'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
  );
}, arePropsEqual);
