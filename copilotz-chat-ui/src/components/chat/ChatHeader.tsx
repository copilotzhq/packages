import React from 'react';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
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
} from 'lucide-react';
import { ReactNode } from 'react';
import { SidebarTrigger } from '../ui/sidebar';

export interface ChatHeaderConfig {
  branding?: {
    logo?: ReactNode;
    title?: string;
    subtitle?: string;
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

  return (
    <Card
      data-chat-header
      className={`py-0 border-b rounded-none relative z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${className}`}
      style={isMobile ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
    >
      <CardHeader className="p-2">
        <div className="flex items-center justify-between">
          {/* Left side - Sidebar toggle */}
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1" />
              </TooltipTrigger>
              <TooltipContent>
                {config.labels?.sidebarToggle || 'Toggle Sidebar'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Center - Logo and Title */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            {config.branding?.logo || (
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
            <div className="text-center hidden md:block">
              <CardTitle className="text-sm font-medium">
                {config.branding?.title || 'Chat Assistant'}
              </CardTitle>
            </div>
            {/* Mobile only title if needed, or keep it simple */}
            <div className="md:hidden text-sm font-medium truncate max-w-[150px]">
                {currentThreadTitle || config.branding?.title || 'Chat'}
            </div>
          </div>

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
