import React from 'react';
import { Card, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Bot,
  MoreVertical,
  Download,
  Upload,
  Trash2,
  Plus,
  Menu,
  Moon,
  Sun,
  ChevronDown,
  Check,
} from 'lucide-react';
import { ReactNode } from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import type { AgentOption } from '../../types/chatTypes';

export interface ChatHeaderConfig {
  branding?: {
    logo?: ReactNode;
    title?: string;
    subtitle?: string;
  };
  agentSelector?: {
    enabled?: boolean;
    label?: string;
    hideIfSingle?: boolean;
  };
  labels?: {
    newThread?: string;
    exportData?: string;
    importData?: string;
    clearAll?: string;
    sidebarToggle?: string;
    customComponentToggle?: string;
    settings?: string;
    toggleDarkMode?: string;
    lightMode?: string;
    darkMode?: string;
  };
  customComponent?: {
    label?: string;
    icon?: ReactNode;
    onClick?: () => void;
  };
  /** Additional actions to render in the header (before the settings menu) */
  headerActions?: ReactNode;
}

export interface ChatHeaderProps {
  config: ChatHeaderConfig;
  currentThreadTitle?: string | null;
  onSidebarToggle?: () => void;
  onCustomComponentToggle?: () => void;
  onNewThread?: () => void;
  onExportData?: () => void;
  onImportData?: (file: File) => void;
  onClearAll?: () => void;
  showCustomComponentButton?: boolean;
  isMobile?: boolean;
  showAgentSelector?: boolean;
  agentOptions?: AgentOption[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  config,
  currentThreadTitle,
  onSidebarToggle: _onSidebarToggle,
  onCustomComponentToggle,
  onNewThread,
  onExportData,
  onImportData,
  onClearAll,
  showCustomComponentButton,
  isMobile,
  showAgentSelector = false,
  agentOptions = [],
  selectedAgentId = null,
  onSelectAgent,
  className = '',
}) => {
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Listen for system theme changes
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        // Only update if user hasn't set an explicit preference
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDarkMode(!isDark);
  };


  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onImportData) {
        onImportData(file);
      }
    };
    input.click();
  };

  const selectedAgent = agentOptions.find((agent) => agent.id === selectedAgentId) || null;
  const agentPlaceholder = config.agentSelector?.label || 'Select agent';

  return (
    <Card
      data-chat-header
      className={`py-0 border-b rounded-none relative z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${className}`}
      style={isMobile ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
    >
      <CardHeader className="p-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left side - Sidebar toggle + Agent Selector */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1" />
              </TooltipTrigger>
              <TooltipContent>
                {config.labels?.sidebarToggle || 'Toggle Sidebar'}
              </TooltipContent>
            </Tooltip>

            {/* Agent Selector - ChatGPT style */}
            {showAgentSelector && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 px-3 gap-1.5 font-medium text-base hover:bg-accent/50"
                  >
                    {selectedAgent?.avatarUrl ? (
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={selectedAgent.avatarUrl} alt={selectedAgent.name} />
                        <AvatarFallback className="text-[10px]">
                          {selectedAgent.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    <span className="max-w-[200px] truncate">
                      {selectedAgent?.name || agentPlaceholder}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[280px]">
                  {agentOptions.map((agent) => {
                    const isSelected = agent.id === selectedAgentId;
                    return (
                      <DropdownMenuItem
                        key={agent.id}
                        onClick={() => onSelectAgent?.(agent.id)}
                        className="flex items-start gap-3 p-3 cursor-pointer"
                      >
                        {agent.avatarUrl ? (
                          <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                            <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                            <AvatarFallback className="text-[10px]">
                              {agent.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-6 w-6 mt-0.5 shrink-0 flex items-center justify-center rounded-full bg-primary/10">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
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
            )}

            {/* Mobile title when no agent selector */}
            {!showAgentSelector && isMobile && (
              <span className="text-sm font-medium truncate max-w-[150px] ml-2">
                {currentThreadTitle || config.branding?.title || 'Chat'}
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side - Custom component button + Settings menu */}
          <div className="flex items-center gap-1">
            {/* Custom component toggle button (desktop + mobile) */}
            {showCustomComponentButton && config.customComponent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onCustomComponentToggle}
                  >
                    {config.customComponent.icon || <Menu className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {config.customComponent.label || config.labels?.customComponentToggle || 'Toggle'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Custom header actions (passed from parent) */}
            {config.headerActions}

            {/* Settings dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onNewThread && (
                  <>
                    <DropdownMenuItem onClick={() => onNewThread?.()} className="font-medium text-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      {config.labels?.newThread || 'New Thread'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {onExportData && (
                  <DropdownMenuItem onClick={onExportData}>
                    <Download className="h-4 w-4 mr-2" />
                    {config.labels?.exportData || 'Export Data'}
                  </DropdownMenuItem>
                )}

                {onImportData && (
                  <DropdownMenuItem onClick={handleImportClick}>
                    <Upload className="h-4 w-4 mr-2" />
                    {config.labels?.importData || 'Import Data'}
                  </DropdownMenuItem>
                )}

                {(onExportData || onImportData) && (
                  <DropdownMenuSeparator />
                )}

                <DropdownMenuItem onClick={toggleDarkMode}>
                  {isDarkMode ? (
                    <>
                      <Sun className="h-4 w-4 mr-2" />
                      {config.labels?.lightMode || 'Light Mode'}
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4 mr-2" />
                      {config.labels?.darkMode || 'Dark Mode'}
                    </>
                  )}
                </DropdownMenuItem>

                {onClearAll && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onClearAll}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {config.labels?.clearAll || 'Clear All'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
