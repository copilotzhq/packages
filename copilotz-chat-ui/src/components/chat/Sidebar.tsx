import React, { useEffect, useRef, useState } from "react";
import { ChatThread, ChatUserMenuSection } from "../../types/chatTypes";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "../ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Archive,
  Bot,
  Edit2,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  UserMenu,
  UserMenuCallbacks,
  UserMenuConfig,
  UserMenuUser,
} from "./UserMenu";
import { Avatar, AvatarFallback } from "../ui/avatar";

export interface SidebarConfig {
  labels?: {
    newChat?: string;
    search?: string;
    customComponentLabel?: string;
    showArchived?: string;
    hideArchived?: string;
    noThreadsFound?: string;
    noThreadsYet?: string;
    deleteConfirmTitle?: string;
    deleteConfirmDescription?: string;
    renameThread?: string;
    archiveThread?: string;
    unarchiveThread?: string;
    deleteThread?: string;
    today?: string;
    yesterday?: string;
    createNewThread?: string;
    threadNamePlaceholder?: string;
    cancel?: string;
    create?: string;
    daysAgo?: string;
  };
  branding?: {
    logo?: React.ReactNode;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
  };
  userMenu?: UserMenuConfig;
}

export interface SidebarProps
  extends React.ComponentProps<typeof ShadcnSidebar> {
  threads: ChatThread[];
  currentThreadId?: string | null;
  config: SidebarConfig;
  onCreateThread?: (title?: string) => void;
  onSelectThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onArchiveThread?: (threadId: string) => void;
  // User menu props
  user?: UserMenuUser | null;
  userMenuCallbacks?: UserMenuCallbacks;
  currentTheme?: "light" | "dark" | "system";
  showThemeOptions?: boolean;
  userMenuSections?: ChatUserMenuSection[];
  /** Additional items to render in the user menu */
  userMenuAdditionalItems?: React.ReactNode;
}

// Create thread dialog
const CreateThreadDialog: React.FC<{
  config: SidebarConfig;
  onCreateThread: (title?: string) => void;
  trigger?: React.ReactNode;
}> = ({ config, onCreateThread, trigger }) => {
  const [title, setTitle] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    onCreateThread(title.trim() || undefined);
    setTitle("");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full justify-start" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {config.labels?.newChat || "New Chat"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {config.labels?.createNewThread || "New Conversation"}
          </DialogTitle>
          <DialogDescription>
            Give your new conversation a name or leave blank to auto-generate
            one.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={config.labels?.threadNamePlaceholder ||
            "Conversation name"}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {config.labels?.cancel || "Cancel"}
          </Button>
          <Button onClick={handleCreate}>
            {config.labels?.create || "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ThreadInitialsIcon = ({ title }: { title: string }) => {
  const initials = title
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="flex shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium">
      {initials}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  threads,
  currentThreadId,
  config,
  onCreateThread,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onArchiveThread,
  // User menu props
  user,
  userMenuCallbacks,
  currentTheme,
  showThemeOptions = true,
  userMenuSections,
  userMenuAdditionalItems,
  ...props
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Use the sidebar context to control expansion
  const { setOpen } = useSidebar();

  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingThreadId]);

  // Filter threads based on search and archive filter
  const filteredThreads = threads.filter((thread) => {
    const title = (thread.title ?? "").toString();
    const matchesSearch = title.toLowerCase().includes(
      searchQuery.toLowerCase(),
    );
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
      groupKey = config.labels?.today || "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = config.labels?.yesterday || "Yesterday";
    } else {
      groupKey = date.toLocaleDateString("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long",
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

  const startEditing = (thread: ChatThread) => {
    setEditingThreadId(thread.id);
    setEditTitle(thread.title || "");
  };

  const saveEdit = () => {
    if (editingThreadId && editTitle.trim()) {
      onRenameThread?.(editingThreadId, editTitle.trim());
    }
    setEditingThreadId(null);
  };

  const cancelEdit = () => {
    setEditingThreadId(null);
  };

  return (
    <ShadcnSidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* Branding / Logo */}
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex items-center justify-center shrink-0">
            {config.branding?.logo || (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold truncate">
              {config.branding?.title || "Chat"}
            </span>
            {config.branding?.subtitle && (
              <span className="text-xs text-muted-foreground truncate">
                {config.branding.subtitle}
              </span>
            )}
          </div>
        </div>

        {/* New Chat Button */}
        {onCreateThread && (
          <CreateThreadDialog
            config={config}
            onCreateThread={onCreateThread}
            trigger={
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="lg"
                    className="w-full justify-start gap-2 border border-sidebar-border shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                    tooltip={config.labels?.newChat || "New Chat"}
                  >
                    <Plus className="size-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {config.labels?.newChat || "New Chat"}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            }
          />
        )}

        {/* Search */}
        <div className="px-2 py-1 mt-4">
          {/* Expanded View: Input */}
          <div className="relative group-data-[collapsible=icon]:hidden">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
            <Input
              className="pl-8 h-8 bg-sidebar-accent/50 border-sidebar-border focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              placeholder={config.labels?.search || "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Collapsed View: Search Icon Button (expands sidebar on click) */}
          <div className="hidden group-data-[collapsible=icon]:flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(true)}
              title={config.labels?.search || "Search"}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Archive Filter Toggle (if needed) */}
        {threads.some((t) => t.isArchived) && (
          <div className="px-4 py-2 mt-2 group-data-[collapsible=icon]:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="h-6 text-xs w-full justify-start text-muted-foreground"
            >
              <Filter className="mr-2 h-3 w-3" />
              {showArchived
                ? (config.labels?.hideArchived || "Hide Archived")
                : (config.labels?.showArchived || "Show Archived")}
            </Button>
          </div>
        )}

        {Object.keys(groupedThreads).length === 0
          ? (
            <div className="px-4 py-8 text-center text-muted-foreground group-data-[collapsible=icon]:hidden">
              <div className="mx-auto h-8 w-8 mb-2 flex items-center justify-center rounded-full bg-muted/50">
                <Plus className="h-4 w-4 opacity-50" />
              </div>
              <p className="text-xs">
                {searchQuery
                  ? (config.labels?.noThreadsFound || "No conversations found")
                  : (config.labels?.noThreadsYet || "No conversations yet")}
              </p>
            </div>
          )
          : (
            Object.entries(groupedThreads).map(([group, groupThreads]) => (
              <SidebarGroup className="mt-2" key={group}>
                <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                  {group}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {groupThreads.map((thread) => (
                      <SidebarMenuItem key={thread.id}>
                        {editingThreadId === thread.id
                          ? (
                            <div className="flex items-center gap-1 px-2 py-1">
                              <Input
                                ref={inputRef}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    saveEdit();
                                  }
                                  if (e.key === "Escape") {
                                    cancelEdit();
                                  }
                                }}
                                onBlur={saveEdit}
                                className="h-7 text-sm"
                              />
                            </div>
                          )
                          : (
                            <SidebarMenuButton
                              isActive={currentThreadId === thread.id}
                              onClick={() => onSelectThread?.(thread.id)}
                              tooltip={thread.title}
                            >
                              <ThreadInitialsIcon title={thread.title || "?"} />
                              <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                                <span className="truncate w-full">
                                  {thread.title || "New Chat"}
                                </span>
                              </div>
                              {thread.isArchived && (
                                <Archive className="ml-auto h-3 w-3 opacity-50 group-data-[collapsible=icon]:hidden" />
                              )}
                            </SidebarMenuButton>
                          )}

                        {!editingThreadId && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction showOnHover>
                                <MoreHorizontal />
                                <span className="sr-only">More</span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              className="w-48"
                              side="right"
                              align="start"
                            >
                              <DropdownMenuItem
                                onClick={() => startEditing(thread)}
                              >
                                <Edit2 className="mr-2 h-4 w-4" />
                                <span>
                                  {config.labels?.renameThread || "Rename"}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  onArchiveThread?.(thread.id)}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                <span>
                                  {thread.isArchived
                                    ? (config.labels?.unarchiveThread ||
                                      "Unarchive")
                                    : (config.labels?.archiveThread ||
                                      "Archive")}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteThreadId(thread.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>
                                  {config.labels?.deleteThread || "Delete"}
                                </span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          )}
      </SidebarContent>

    <SidebarFooter>
      <UserMenu
        user={user}
        config={config.userMenu}
        callbacks={userMenuCallbacks}
          currentTheme={currentTheme}
          showThemeOptions={showThemeOptions}
          sections={userMenuSections}
          additionalItems={userMenuAdditionalItems}
        />
      </SidebarFooter>

      <SidebarRail />

      {/* Delete confirmation dialog - only render when needed to avoid Radix focus conflicts */}
      {deleteThreadId && (
        <AlertDialog
          open={!!deleteThreadId}
          onOpenChange={() => setDeleteThreadId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {config.labels?.deleteConfirmTitle || "Delete Conversation"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {config.labels?.deleteConfirmDescription ||
                  "Are you sure you want to delete this conversation? This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {config.labels?.cancel || "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteThreadId && handleDeleteThread(deleteThreadId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {config.labels?.deleteThread || "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </ShadcnSidebar>
  );
};
