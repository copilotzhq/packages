import React, { useState, useRef, useEffect } from 'react';
import { ChatThread, ChatConfig } from '../../types/chatTypes';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { TooltipProvider } from '../ui/tooltip';
import {
  Plus,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Archive,
  Search,
  Filter,
  Calendar,
  Hash,
  X,
  Check,
} from 'lucide-react';

interface ThreadManagerProps {
  threads: ChatThread[];
  currentThreadId?: string | null;
  config?: ChatConfig;
  onCreateThread?: (title?: string) => void;
  onSelectThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onArchiveThread?: (threadId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

// Individual thread item component
const ThreadItem: React.FC<{
  thread: ChatThread;
  isActive: boolean;
  config?: ChatConfig;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  onArchive: () => void;
}> = ({ thread, isActive, config, onSelect, onRename, onDelete, onArchive }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle && trimmedTitle !== thread.title) {
      onRename(trimmedTitle);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(thread.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <Card className={`cursor-pointer transition-all duration-200 hover:shadow-md py-0 ${
      isActive ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
    }`}>
      <CardContent className="p-3 max-w-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0" onClick={onSelect}>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  className="h-8 text-sm"
                  placeholder={config?.labels?.threadNamePlaceholder || "Conversation name"}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <h4 className="font-medium text-sm truncate mb-1">
                  {thread.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {thread.messageCount} msgs
                  </div>
                  <Separator orientation="vertical" className="h-3" />
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(thread.updatedAt, config?.labels)}
                  </div>
                  {thread.isArchived && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <Badge variant="secondary" className="text-xs">
                        <Archive className="h-2 w-2 mr-1" />
                        {config?.labels?.archiveThread || 'Archived'}
                      </Badge>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {!isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 m-auto">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  {config?.labels?.renameThread || 'Rename'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  {thread.isArchived 
                    ? (config?.labels?.unarchiveThread || 'Unarchive')
                    : (config?.labels?.archiveThread || 'Archive')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {config?.labels?.deleteThread || 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Create thread dialog
const CreateThreadDialog: React.FC<{
  onCreateThread: (title?: string) => void;
  config?: ChatConfig;
}> = ({ onCreateThread, config }) => {
  const [title, setTitle] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    onCreateThread(title.trim() || undefined);
    setTitle('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          {config?.labels?.createNewThread || 'New Conversation'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config?.labels?.createNewThread || 'Create New Conversation'}</DialogTitle>
          <DialogDescription>
            Give your new conversation a name or leave blank to auto-generate one.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={config?.labels?.threadNamePlaceholder || "Conversation name (optional)"}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {config?.labels?.cancel || 'Cancel'}
          </Button>
          <Button onClick={handleCreate}>
            {config?.labels?.create || 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ThreadManager: React.FC<ThreadManagerProps> = ({
  threads,
  currentThreadId,
  config,
  onCreateThread,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onArchiveThread,
  isOpen = false,
  onClose,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);

  // Filter threads based on search and archive filter
  const filteredThreads = threads.filter(thread => {
    const title = (thread.title ?? '').toString();
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchiveFilter = showArchived || !thread.isArchived;
    return matchesSearch && matchesArchiveFilter;
  });

  // Group threads by date
  const groupedThreads = filteredThreads.reduce((groups, thread) => {
    const date = new Date(thread.updatedAt);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = config?.labels?.today || 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = config?.labels?.yesterday || 'Yesterday';
    } else {
      groupKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(thread);
    return groups;
  }, {} as Record<string, ChatThread[]>);

  const handleDeleteThread = (threadId: string) => {
    onDeleteThread?.(threadId);
    setDeleteThreadId(null);
  };

  if (!isOpen) return null;

  return (
    <TooltipProvider>
      <div className={`fixed inset-0 z-50 bg-background/80 backdrop-blur-sm ${className}`}>
        <div className="fixed left-0 top-0 h-full w-full max-w-md border-r bg-background shadow-lg">
          <Card className="h-full border-0 rounded-none">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {config?.labels?.newChat || 'Conversations'}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={onClose} >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Search and filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={config?.labels?.search || "Search conversations..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                    className="text-xs"
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    {showArchived 
                      ? (config?.labels?.hideArchived || 'Hide Archived')
                      : (config?.labels?.showArchived || 'Show Archived')}
                  </Button>
                  
                  <Badge variant="secondary" className="text-xs">
                    {filteredThreads.length} / {threads.length}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1">
              <div className="p-4">
                {onCreateThread && (
                  <CreateThreadDialog onCreateThread={onCreateThread} config={config} />
                )}
              </div>

              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="px-4 pb-4 space-y-4">
                  {Object.keys(groupedThreads).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        {searchQuery 
                          ? (config?.labels?.noThreadsFound || 'No conversations found')
                          : (config?.labels?.noThreadsYet || 'No conversations yet')}
                      </p>
                    </div>
                  ) : (
                    Object.entries(groupedThreads).map(([group, groupThreads]: [string, ChatThread[]]) => (
                      <div key={group}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                          {group}
                        </h3>
                        <div className="space-y-2">
                          {groupThreads.map((thread) => (
                            <ThreadItem
                              key={thread.id}
                              thread={thread}
                              isActive={currentThreadId === thread.id}
                              config={config}
                              onSelect={() => onSelectThread?.(thread.id)}
                              onRename={(newTitle) => onRenameThread?.(thread.id, newTitle)}
                              onDelete={() => setDeleteThreadId(thread.id)}
                              onArchive={() => onArchiveThread?.(thread.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteThreadId} onOpenChange={() => setDeleteThreadId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{config?.labels?.deleteConfirmTitle || 'Delete Conversation'}</AlertDialogTitle>
              <AlertDialogDescription>
                {config?.labels?.deleteConfirmDescription || 'Are you sure you want to delete this conversation? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{config?.labels?.cancel || 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteThreadId && handleDeleteThread(deleteThreadId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {config?.labels?.deleteThread || 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};
