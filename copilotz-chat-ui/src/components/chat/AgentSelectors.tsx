import React, { memo, useMemo } from 'react';
import { Check, ChevronDown, Users, AtSign, X } from 'lucide-react';
import { AgentOption } from '../../types/chatTypes';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { getAgentColor, getAgentInitials, assignAgentColors } from '../../lib/chatUtils';

interface ParticipantsSelectorProps {
  /** All available agents */
  agents: AgentOption[];
  /** Currently selected participant IDs */
  participantIds: string[];
  /** Callback when participants change */
  onParticipantsChange: (ids: string[]) => void;
  /** Label for the selector */
  label?: string;
  /** Maximum participants to show in collapsed view */
  maxVisible?: number;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Multi-select dropdown for choosing which agents participate in the conversation.
 */
export const ParticipantsSelector: React.FC<ParticipantsSelectorProps> = memo(({
  agents,
  participantIds,
  onParticipantsChange,
  label = 'Team',
  maxVisible = 3,
  disabled = false,
}) => {
  // Assign colors to agents that don't have them
  const agentsWithColors = useMemo(() => assignAgentColors(agents), [agents]);
  
  // Get selected agents
  const selectedAgents = useMemo(() => 
    agentsWithColors.filter(a => participantIds.includes(a.id)),
    [agentsWithColors, participantIds]
  );
  
  const toggleParticipant = (agentId: string) => {
    if (participantIds.includes(agentId)) {
      // Don't allow removing the last participant
      if (participantIds.length > 1) {
        onParticipantsChange(participantIds.filter(id => id !== agentId));
      }
    } else {
      onParticipantsChange([...participantIds, agentId]);
    }
  };
  
  const selectAll = () => {
    onParticipantsChange(agentsWithColors.map(a => a.id));
  };
  
  const visibleAgents = selectedAgents.slice(0, maxVisible);
  const hiddenCount = selectedAgents.length - maxVisible;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 px-2 gap-1.5 text-sm hover:bg-accent/50"
          disabled={disabled}
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1">
            {visibleAgents.length > 0 ? (
              <>
                <div className="flex -space-x-1.5">
                  {visibleAgents.map(agent => (
                    <Avatar key={agent.id} className="h-5 w-5 border-2 border-background">
                      <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                      <AvatarFallback
                        style={{ backgroundColor: agent.color || getAgentColor(agent.id), color: 'white' }}
                        className="text-[8px]"
                      >
                        {getAgentInitials(agent.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <span className="text-xs text-muted-foreground">+{hiddenCount}</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{label}</span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Participants</span>
          {selectedAgents.length < agentsWithColors.length && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>
              Select All
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {agentsWithColors.map(agent => {
          const isSelected = participantIds.includes(agent.id);
          const isLastSelected = isSelected && participantIds.length === 1;
          
          return (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => toggleParticipant(agent.id)}
              className="flex items-center gap-3 p-2 cursor-pointer"
              disabled={isLastSelected}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                <AvatarFallback
                  style={{ backgroundColor: agent.color || getAgentColor(agent.id), color: 'white' }}
                  className="text-[10px]"
                >
                  {getAgentInitials(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{agent.name}</div>
                {agent.description && (
                  <div className="text-xs text-muted-foreground truncate">{agent.description}</div>
                )}
              </div>
              {isSelected && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

ParticipantsSelector.displayName = 'ParticipantsSelector';

interface TargetAgentSelectorProps {
  /** Available agents (should be filtered to participants only) */
  agents: AgentOption[];
  /** Currently targeted agent ID */
  targetAgentId: string | null;
  /** Callback when target changes */
  onTargetChange: (agentId: string | null) => void;
  /** Label for the selector */
  label?: string;
  /** Placeholder when no target is selected */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Compact visual treatment for composer/toolbars */
  compact?: boolean;
}

/**
 * Single-select dropdown for choosing which agent to address with @mention.
 */
export const TargetAgentSelector: React.FC<TargetAgentSelectorProps> = memo(({
  agents,
  targetAgentId,
  onTargetChange,
  label = 'Target',
  placeholder = 'Select agent',
  disabled = false,
  compact = false,
}) => {
  // Assign colors to agents
  const agentsWithColors = useMemo(() => assignAgentColors(agents), [agents]);
  
  // Get selected agent
  const selectedAgent = useMemo(() => 
    agentsWithColors.find(a => a.id === targetAgentId),
    [agentsWithColors, targetAgentId]
  );
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`gap-1.5 font-medium hover:bg-accent/50 ${
            compact
              ? 'h-9 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground'
              : 'h-9 px-3 text-base'
          }`}
          disabled={disabled}
        >
          <AtSign className="h-4 w-4 text-muted-foreground" />
          {selectedAgent ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedAgent.avatarUrl} alt={selectedAgent.name} />
                <AvatarFallback
                  style={{ backgroundColor: selectedAgent.color || getAgentColor(selectedAgent.id), color: 'white' }}
                  className="text-[10px]"
                >
                  {getAgentInitials(selectedAgent.name)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[150px] truncate">{selectedAgent.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {agentsWithColors.map(agent => {
          const isSelected = agent.id === targetAgentId;
          
          return (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => onTargetChange(agent.id)}
              className="flex items-start gap-3 p-3 cursor-pointer"
            >
              <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                <AvatarFallback
                  style={{ backgroundColor: agent.color || getAgentColor(agent.id), color: 'white' }}
                  className="text-[10px]"
                >
                  {getAgentInitials(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{agent.name}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
                {agent.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {agent.description}
                  </p>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

TargetAgentSelector.displayName = 'TargetAgentSelector';

interface AgentBadgeProps {
  agent: AgentOption;
  onRemove?: () => void;
  showRemove?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Badge displaying an agent with optional remove button.
 */
export const AgentBadge: React.FC<AgentBadgeProps> = memo(({
  agent,
  onRemove,
  showRemove = false,
  size = 'md',
}) => {
  const color = agent.color || getAgentColor(agent.id);
  const avatarSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  
  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1.5 pr-1"
      style={{ borderColor: color, borderWidth: 1 }}
    >
      <Avatar className={avatarSize}>
        <AvatarImage src={agent.avatarUrl} alt={agent.name} />
        <AvatarFallback
          style={{ backgroundColor: color, color: 'white' }}
          className="text-[8px]"
        >
          {getAgentInitials(agent.name)}
        </AvatarFallback>
      </Avatar>
      <span className={textSize}>{agent.name}</span>
      {showRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 ml-0.5 hover:bg-destructive/20"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Badge>
  );
});

AgentBadge.displayName = 'AgentBadge';
