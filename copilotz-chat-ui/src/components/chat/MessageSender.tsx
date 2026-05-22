import React from 'react';
import type { ChatSender } from '../../types/chatTypes';
import { getAgentColor, getAgentInitials } from '../../lib/chatUtils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export interface MessageSenderDisplay {
  name: string;
  avatar: React.ReactNode;
  color?: string;
}

export const resolveMessageSenderDisplay = ({
  sender,
  fallbackName,
  fallbackAvatar,
  fallbackAvatarUrl,
  compactMode = false,
}: {
  sender?: ChatSender;
  fallbackName: string;
  fallbackAvatar?: React.ReactNode;
  fallbackAvatarUrl?: string;
  compactMode?: boolean;
}): MessageSenderDisplay => {
  const name = sender?.name?.trim() || fallbackName;
  const isAgentLike = sender?.type === 'agent' || sender?.type === 'tool' || sender?.type === 'job';
  const color = sender?.color || (isAgentLike && sender?.id ? getAgentColor(sender.id) : undefined);
  const fallbackClassName = color
    ? `${compactMode ? 'text-[10px]' : ''}`
    : sender?.type === 'user'
      ? 'bg-primary text-primary-foreground'
      : 'bg-secondary text-secondary-foreground';

  const fallbackContent = isAgentLike
    ? getAgentInitials(name)
    : name.charAt(0).toUpperCase();
  const shouldUseFallbackAvatar = Boolean(
    fallbackAvatar && (!sender || (sender.id === 'assistant' && !sender.avatarUrl)),
  );

  return {
    name,
    color,
    avatar: (
      <>
        {sender?.avatarUrl || fallbackAvatarUrl ? (
          <AvatarImage src={sender?.avatarUrl || fallbackAvatarUrl} alt={name} />
        ) : null}
        {shouldUseFallbackAvatar ? (
          fallbackAvatar
        ) : (
          <AvatarFallback
            className={fallbackClassName}
            style={color ? { backgroundColor: color, color: 'white' } : undefined}
          >
            {fallbackContent}
          </AvatarFallback>
        )}
      </>
    ),
  };
};

export const MessageSenderAvatar: React.FC<{
  sender?: ChatSender;
  fallbackName: string;
  fallbackAvatar?: React.ReactNode;
  fallbackAvatarUrl?: string;
  compactMode?: boolean;
}> = ({
  sender,
  fallbackName,
  fallbackAvatar,
  fallbackAvatarUrl,
  compactMode = false,
}) => {
  const display = resolveMessageSenderDisplay({
    sender,
    fallbackName,
    fallbackAvatar,
    fallbackAvatarUrl,
    compactMode,
  });

  return (
    <Avatar className={compactMode ? 'h-6 w-6' : 'h-8 w-8'}>
      {display.avatar}
    </Avatar>
  );
};
