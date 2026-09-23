import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatSpace,
  ChatSpaceManagementHandler,
  ChatState,
  StateCallback,
  ChatThread,
  ChatUserMenuSection,
} from "../../types/chatTypes";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
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
  ArrowRightLeft,
  Bot,
  ChevronRight,
  Edit2,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
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
    chats?: string;
    newChat?: string;
    newThread?: string;
    newSpace?: string;
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
    spaces?: string;
    groupBy?: string;
    groupByDate?: string;
    groupBySpaces?: string;
    noSpace?: string;
    selectSpace?: string;
    moveToSpace?: string;
    removeFromSpace?: string;
    createSpace?: string;
    spaceNamePlaceholder?: string;
    searchSpaces?: string;
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
  features?: {
    spaces?: {
      enabled?: boolean;
      groupingEnabled?: boolean;
      defaultGroupBy?: "date" | "space";
      allowCreate?: boolean;
      allowDrag?: boolean;
    };
  };
  userMenu?: UserMenuConfig;
}

type SpaceMoveHandler = (
  threadId: string,
  spaceId: string | null,
  callback?: StateCallback<ChatState>
) => void | Promise<unknown>;
type SpaceCreateHandler = (
  name: string,
  callback?: StateCallback<ChatState>
) => ChatSpace | void | Promise<ChatSpace | void>;
type SpaceManagementHandler = ChatSpaceManagementHandler;

export interface SidebarProps
  extends React.ComponentProps<typeof ShadcnSidebar> {
  threads: ChatThread[];
  spaces?: readonly ChatSpace[];
  currentThreadId?: string | null;
  currentSpaceId?: string | null;
  config: SidebarConfig;
  onCreateThread?: (title?: string) => void;
  onSelectThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onCreateSpace?: SpaceCreateHandler;
  onManageSpace?: SpaceManagementHandler;
  onMoveThreadToSpace?: SpaceMoveHandler;
  /** Opens the Space main view. Conversation expansion remains a separate control. */
  onOpenSpace?: (spaceId: string) => void;
  // User menu props
  user?: UserMenuUser | null;
  userMenuCallbacks?: UserMenuCallbacks;
  currentTheme?: "light" | "dark" | "system";
  showThemeOptions?: boolean;
  userMenuSections?: ChatUserMenuSection[];
  /** Additional items to render in the user menu */
  userMenuAdditionalItems?: React.ReactNode;
}

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
          placeholder={
            config.labels?.threadNamePlaceholder || "Conversation name"
          }
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
  const initials =
    title
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground">
      {initials}
    </div>
  );
};

const SPACE_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function spaceColor(spaceId: string): string {
  let hash = 0;
  for (const char of spaceId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return SPACE_COLORS[Math.abs(hash) % SPACE_COLORS.length];
}

function initials(value: string): string {
  return value.split(" ").filter(Boolean).map((word) => word[0]).slice(0, 2)
    .join("").toUpperCase() || "?";
}

function SpaceAvatar({ space, className = "" }: {
  space: ChatSpace;
  className?: string;
}) {
  return (
    <span
      aria-label={`${space.name || space.id} Space`}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold text-white ${spaceColor(space.id)} ${className}`}
    >
      {initials(space.name || space.id)}
    </span>
  );
}

type ThreadGroup = {
  key: string;
  label: string;
  spaceId: string | null;
  space?: ChatSpace;
  threads: ChatThread[];
  muted?: boolean;
};

const SpacePickerDialog: React.FC<{
  config: SidebarConfig;
  thread: ChatThread;
  spaces: readonly ChatSpace[];
  allowCreate: boolean;
  onMove: SpaceMoveHandler;
  onCreate?: SpaceCreateHandler;
  onClose: () => void;
}> = ({ config, thread, spaces, allowCreate, onMove, onCreate, onClose }) => {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = search.trim().toLowerCase();
  const matches = spaces.filter((space) =>
    !query || space.name.toLowerCase().includes(query) ||
      space.id.toLowerCase().includes(query)
  );

  const move = async (spaceId: string | null) => {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      const result = await onMove(thread.id, spaceId);
      if (result === false) {
        setError("This conversation could not be moved.");
        return;
      }
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This conversation could not be moved."
      );
    } finally {
      setWorking(false);
    }
  };

  const create = async () => {
    if (working) return;
    const trimmed = name.trim();
    if (!trimmed || !onCreate) return;
    setWorking(true);
    setError(null);
    try {
      const created = await onCreate(trimmed);
      if (!created?.id) {
        setError("The Space could not be created.");
        return;
      }
      const result = await onMove(thread.id, created.id);
      if (result === false) {
        setError("The Space was created, but this conversation could not be moved.");
        return;
      }
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The Space could not be created."
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {config.labels?.selectSpace || "Select Space"}
        </DialogTitle>
        <DialogDescription>{thread.title || "Conversation"}</DialogDescription>
      </DialogHeader>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={config.labels?.searchSpaces || "Search Spaces"}
            placeholder={config.labels?.searchSpaces || "Search Spaces"}
            className="pl-9"
            autoFocus
            disabled={working}
          />
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          <Button
            type="button"
            variant={thread.spaceId == null ? "secondary" : "ghost"}
            className="w-full justify-start"
            disabled={working || thread.spaceId == null}
            onClick={() => void move(null)}
          >
            <X className="mr-2 h-4 w-4" />
            {config.labels?.noSpace || "No Space"}
          </Button>
          {matches.map((space) => (
            <Button
              type="button"
              key={space.id}
              variant={thread.spaceId === space.id ? "secondary" : "ghost"}
              className="w-full justify-start"
              disabled={working || thread.spaceId === space.id}
              onClick={() => void move(space.id)}
            >
              <SpaceAvatar space={space} className="mr-2" />
              <span className="truncate">{space.name || space.id}</span>
            </Button>
          ))}
          {matches.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {config.labels?.noThreadsFound || "No Spaces found"}
            </p>
          )}
        </div>
        {allowCreate && onCreate && (
          <div className="flex gap-2 border-t pt-3">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label={
                config.labels?.spaceNamePlaceholder || "Space name"
              }
              placeholder={
                config.labels?.spaceNamePlaceholder || "Space name"
              }
              disabled={working}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void create();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => void create()}
              disabled={working || !name.trim()}
            >
              {config.labels?.createSpace || "Create Space"}
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  threads,
  spaces = [],
  currentThreadId,
  currentSpaceId,
  config,
  onCreateThread,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onArchiveThread,
  onCreateSpace,
  onManageSpace,
  onMoveThreadToSpace,
  onOpenSpace,
  user,
  userMenuCallbacks,
  currentTheme,
  showThemeOptions = true,
  userMenuSections,
  userMenuAdditionalItems,
  ...props
}) => {
  const [viewMode, setViewMode] = useState<"chats" | "spaces">("chats");
  useEffect(() => {
    setViewMode(currentSpaceId ? "spaces" : "chats");
  }, [currentSpaceId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [spacePickerThreadId, setSpacePickerThreadId] = useState<string | null>(
    null
  );
  const [draggingThreadId, setDraggingThreadId] = useState<string | null>(null);
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [spaceCreateError, setSpaceCreateError] = useState<string | null>(null);
  const [isCreatingSpaceRequest, setIsCreatingSpaceRequest] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const inputRef = useRef<HTMLInputElement>(null);
  const spaceCreateInputRef = useRef<HTMLInputElement>(null);
  const { setOpen } = useSidebar();
  const spacesConfig = config.features?.spaces;
  const spacesEnabled =
    spacesConfig?.enabled !== false &&
    (spaces.length > 0 || !!onMoveThreadToSpace || !!onManageSpace || !!onCreateSpace);
  const canMoveSpaces = spacesEnabled && !!onMoveThreadToSpace;
  const canDragSpaces = canMoveSpaces && spacesConfig?.allowDrag !== false;
  const canCreateSpaces =
    spacesEnabled &&
    spacesConfig?.allowCreate !== false &&
    !!(onManageSpace || onCreateSpace);

  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingThreadId]);

  useEffect(() => {
    if (isCreatingSpace) spaceCreateInputRef.current?.focus();
  }, [isCreatingSpace]);

  const activeSpaces = useMemo(
    () => spaces.filter((space) => space.status !== "archived"),
    [spaces]
  );
  const spaceMap = useMemo(
    () => new Map(spaces.map((space) => [space.id, space])),
    [spaces]
  );
  const pickerThread = spacePickerThreadId
    ? threads.find((thread) => thread.id === spacePickerThreadId) ?? null
    : null;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const threadSpace = (thread: ChatThread) =>
    thread.spaceId ? spaceMap.get(thread.spaceId) : undefined;
  const threadMatchesTitle = (thread: ChatThread) =>
    !normalizedSearchQuery ||
    (thread.title ?? "").toString().toLowerCase().includes(normalizedSearchQuery);
  const threadMatchesSpace = (thread: ChatThread) => {
    const space = threadSpace(thread);
    return !!space && (
      space.name.toLowerCase().includes(normalizedSearchQuery) ||
      space.id.toLowerCase().includes(normalizedSearchQuery)
    );
  };
  const filteredThreads = threads.filter((thread) =>
    (showArchived || !thread.isArchived) &&
      (threadMatchesTitle(thread) || threadMatchesSpace(thread))
  );

  const visibleSpaces = useMemo(() => {
    if (!normalizedSearchQuery) return activeSpaces;
    return activeSpaces.filter((space) => {
      const spaceMatches =
        space.name.toLowerCase().includes(normalizedSearchQuery) ||
        space.id.toLowerCase().includes(normalizedSearchQuery);
      const threadMatches = threads.some(
        (thread) =>
          thread.spaceId === space.id &&
          (showArchived || !thread.isArchived) &&
          (thread.title ?? "")
            .toString()
            .toLowerCase()
            .includes(normalizedSearchQuery),
      );
      return spaceMatches || threadMatches;
    });
  }, [activeSpaces, normalizedSearchQuery, showArchived, threads]);

  const spaceThreads = (space: ChatSpace) => {
    const spaceMatches =
      !normalizedSearchQuery ||
      space.name.toLowerCase().includes(normalizedSearchQuery) ||
      space.id.toLowerCase().includes(normalizedSearchQuery);
    return threads.filter(
      (thread) =>
        thread.spaceId === space.id &&
        (showArchived || !thread.isArchived) &&
        (spaceMatches ||
          (thread.title ?? "")
            .toString()
            .toLowerCase()
            .includes(normalizedSearchQuery)),
    );
  };

  const isGroupOpen = (key: string, defaultOpen: boolean) => {
    if (Object.prototype.hasOwnProperty.call(collapsedGroups, key)) {
      return !collapsedGroups[key];
    }
    return defaultOpen || normalizedSearchQuery.length > 0;
  };

  const threadGroups = useMemo((): ThreadGroup[] => {
    const groups: ThreadGroup[] = [];
    const groupMap = new Map<string, ThreadGroup>();
    for (const thread of filteredThreads) {
      const date = new Date(thread.updatedAt);
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      let label: string;
      if (date.toDateString() === today.toDateString()) {
        label = config.labels?.today || "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = config.labels?.yesterday || "Yesterday";
      } else {
        label = date.toLocaleDateString("en-US", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
      }
      const existing = groupMap.get(label);
      if (existing) existing.threads.push(thread);
      else {
        const group = {
          key: `date:${label}`,
          label,
          spaceId: null,
          threads: [thread],
        };
        groupMap.set(label, group);
        groups.push(group);
      }
    }
    return groups;
  }, [
    config.labels?.today,
    config.labels?.yesterday,
    filteredThreads,
  ]);

  const spaceListGroups = useMemo(
    (): ThreadGroup[] =>
      visibleSpaces.map((space) => ({
        key: `space:${space.id}`,
        label: space.name || space.id,
        spaceId: space.id,
        space,
        threads: spaceThreads(space),
      })),
    [visibleSpaces, threads, showArchived, normalizedSearchQuery],
  );
  const isSpaceGrouping = viewMode === "spaces";
  const displayThreadGroups = viewMode === "spaces" ? spaceListGroups : threadGroups;

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
  const toggleGroup = (groupKey: string, open: boolean) => {
    setCollapsedGroups((current) => ({ ...current, [groupKey]: !open }));
  };
  const cancelSpaceCreation = () => {
    if (isCreatingSpaceRequest) return;
    setNewSpaceName("");
    setSpaceCreateError(null);
    setIsCreatingSpace(false);
  };
  const createSpace = async () => {
    const name = newSpaceName.trim();
    if (!name || !onCreateSpace || isCreatingSpaceRequest) return;
    setIsCreatingSpaceRequest(true);
    setSpaceCreateError(null);
    try {
      const created = await onCreateSpace(name);
      if (!created?.id) throw new Error("The Space could not be created.");
      setNewSpaceName("");
      setIsCreatingSpace(false);
    } catch (cause) {
      setSpaceCreateError(
        cause instanceof Error ? cause.message : "The Space could not be created.",
      );
    } finally {
      setIsCreatingSpaceRequest(false);
    }
  };

  return (
    <ShadcnSidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <div className="flex items-center gap-3 px-2 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            {config.branding?.logo || (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">
              {config.branding?.title || "Chat"}
            </span>
            {config.branding?.subtitle && (
              <span className="truncate text-xs text-muted-foreground">
                {config.branding.subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 px-1 group-data-[collapsible=icon]:hidden">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/70 p-1"
            role="group"
            aria-label="Navigation"
          >
            <Button
              type="button"
              aria-pressed={viewMode === "chats"}
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("chats")}
              className={`h-8 rounded-lg px-2 text-xs font-semibold transition-colors ${
                viewMode === "chats"
                  ? "border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              {config.labels?.chats || "Chats"}
            </Button>
            <Button
              type="button"
              aria-pressed={viewMode === "spaces"}
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("spaces")}
              disabled={!spacesEnabled}
              className={`h-8 rounded-lg px-2 text-xs font-semibold transition-colors ${
                viewMode === "spaces"
                  ? "border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              {config.labels?.spaces || "Spaces"}
            </Button>
          </div>

          {viewMode === "chats" && onCreateThread ? (
            <CreateThreadDialog
              config={config}
              onCreateThread={onCreateThread}
              trigger={
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      size="lg"
                      className="h-11 w-full justify-start gap-2 rounded-xl border border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                      tooltip={config.labels?.newThread || config.labels?.newChat || "New Thread"}
                    >
                      <Plus className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {config.labels?.newThread || config.labels?.newChat || "New Thread"}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              }
            />
          ) : viewMode === "spaces" && canCreateSpaces ? (
            <div>
              {onManageSpace || !isCreatingSpace ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-start gap-2 rounded-xl"
                  onClick={() => {
                    if (onManageSpace) {
                      void onManageSpace({ action: "create" });
                    } else {
                      setIsCreatingSpace(true);
                    }
                  }}
                >
                  <Plus className="size-4" />
                  {config.labels?.newSpace || config.labels?.createSpace || "New Space"}
                </Button>
              ) : (
                <div className="flex gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
                  <Input
                    ref={spaceCreateInputRef}
                    value={newSpaceName}
                    onChange={(event) => setNewSpaceName(event.target.value)}
                    aria-label={config.labels?.spaceNamePlaceholder || "Space name"}
                    placeholder={config.labels?.spaceNamePlaceholder || "Space name"}
                    className="h-9"
                    disabled={isCreatingSpaceRequest}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createSpace();
                      }
                      if (event.key === "Escape") cancelSpaceCreation();
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    disabled={!newSpaceName.trim() || isCreatingSpaceRequest}
                    onClick={() => void createSpace()}
                  >
                    {config.labels?.create || "Create"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label={config.labels?.cancel || "Cancel"}
                    disabled={isCreatingSpaceRequest}
                    onClick={cancelSpaceCreation}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {spaceCreateError && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {spaceCreateError}
                </p>
              )}
            </div>
          ) : null}

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 select-none text-sidebar-foreground/45"
            />
            <Input
              className="h-9 rounded-xl border-sidebar-border/80 bg-sidebar pl-3 pr-10 text-sidebar-foreground shadow-sm placeholder:text-sidebar-foreground/50 focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              placeholder={
                viewMode === "spaces"
                  ? config.labels?.searchSpaces || "Search Spaces"
                  : config.labels?.search || "Search conversations..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOpen(true)}
            title={config.labels?.search || "Search"}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {threads.some((thread) => thread.isArchived) && (
          <div className="mt-2 px-4 py-2 group-data-[collapsible=icon]:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="h-6 w-full justify-start text-xs text-muted-foreground"
            >
              <Filter className="mr-2 h-3 w-3" />
              {showArchived
                ? config.labels?.hideArchived || "Hide Archived"
                : config.labels?.showArchived || "Show Archived"}
            </Button>
          </div>
        )}
        {displayThreadGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground group-data-[collapsible=icon]:hidden">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
              <Plus className="h-4 w-4 opacity-50" />
            </div>
            <p className="text-xs">
              {viewMode === "spaces"
                ? searchQuery
                  ? "No Spaces found"
                  : "No Spaces yet"
                : searchQuery
                  ? config.labels?.noThreadsFound || "No conversations found"
                  : config.labels?.noThreadsYet || "No conversations yet"}
            </p>
          </div>
        ) : (
          displayThreadGroups.map((group) => {
            const isOpen = isGroupOpen(
              group.key,
              !isSpaceGrouping || group.spaceId === currentSpaceId,
            );
            const isSelectedSpace =
              isSpaceGrouping && group.spaceId === currentSpaceId;
            return (
              <Collapsible
                key={group.key}
                open={isOpen}
                onOpenChange={(open) => toggleGroup(group.key, open)}
              >
                <SidebarGroup
                  className="mt-1 py-1"
                  onDragOver={(event) => {
                    if (
                      !canDragSpaces ||
                      !isSpaceGrouping ||
                      group.unavailable
                    )
                      return;
                    event.preventDefault();
                    setDragOverSpaceId(group.spaceId);
                  }}
                  onDragLeave={() => {
                    if (dragOverSpaceId === group.spaceId) setDragOverSpaceId(null);
                  }}
                  onDrop={(event) => {
                    if (
                      !canDragSpaces ||
                      !isSpaceGrouping ||
                      group.unavailable
                    )
                      return;
                    event.preventDefault();
                    if (draggingThreadId) {
                      void onMoveThreadToSpace!(draggingThreadId, group.spaceId);
                    }
                    setDraggingThreadId(null);
                    setDragOverSpaceId(null);
                  }}
                >
                  <SidebarGroupLabel
                    className={`group/space-row h-7 justify-start px-1 hover:bg-transparent group-data-[collapsible=icon]:hidden ${
                      dragOverSpaceId === group.spaceId
                        ? "bg-sidebar-accent/50 text-sidebar-accent-foreground"
                        : isSelectedSpace
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "bg-transparent"
                    }`}
                  >
                    <CollapsibleTrigger
                      aria-label={`Expand ${group.label} conversations`}
                      className="group/trigger flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent p-0 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    </CollapsibleTrigger>
                    {isSpaceGrouping && group.space && onOpenSpace ? (
                      <button
                        type="button"
                        aria-current={isSelectedSpace ? "page" : undefined}
                        className={`flex h-7 min-w-0 flex-1 items-center gap-2 truncate rounded-md bg-transparent px-2 text-left focus-visible:ring-2 focus-visible:ring-sidebar-ring ${isSelectedSpace ? "font-medium" : "hover:bg-sidebar-accent"}`}
                        onClick={() => onOpenSpace(group.space!.id)}
                        aria-label={`Open ${group.space.name || group.space.id} Space`}
                      >
                        <SpaceAvatar space={group.space} />
                        <span className={`min-w-0 flex-1 truncate ${group.muted ? "text-muted-foreground" : ""}`}>
                          {group.label}
                        </span>
                      </button>
                    ) : (
                      <CollapsibleTrigger className="flex min-w-0 flex-1 items-center justify-start rounded-md bg-transparent px-1 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                        <span className="min-w-0 flex-1 truncate">{group.label}</span>
                      </CollapsibleTrigger>
                    )}
                      {!isOpen && (!group.space || !onManageSpace) && (
                        <span className="ml-auto px-1.5 text-[10px] text-muted-foreground">
                          {group.threads.length}
                        </span>
                      )}
                    {group.space && onManageSpace && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Manage ${group.space.name || group.space.id} Space`}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 outline-hidden opacity-100 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring md:opacity-0 md:group-hover/space-row:opacity-100 md:focus-visible:opacity-100"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-40"
                          side="right"
                          align="start"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              void onManageSpace({
                                action: "edit",
                                space: group.space!,
                              })
                            }
                          >
                            <Edit2 className="mr-2 h-4 w-4" />
                            <span>Edit Space</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={group.space.deletable !== true}
                            onClick={() =>
                              void onManageSpace({
                                action: "delete",
                                space: group.space!,
                              })
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Space</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </SidebarGroupLabel>
                  {isSpaceGrouping &&
                    group.space &&
                    group.space.status !== "archived" && (
                    <button
                      type="button"
                      aria-label={`Open ${group.space.name || group.space.id} Space group`}
                      className="hidden h-8 w-8 items-center justify-center rounded-md outline-hidden hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:flex"
                      onClick={() => setOpen(true)}
                    >
                      <SpaceAvatar space={group.space} />
                    </button>
                  )}
                  <CollapsibleContent
                    className={
                      isSpaceGrouping
                        ? "group-data-[collapsible=icon]:hidden"
                        : undefined
                    }
                  >
                    <SidebarGroupContent
                      className={isSpaceGrouping ? "pl-4" : undefined}
                    >
                      <SidebarMenu>
                        {group.threads.map((thread) => (
                          <SidebarMenuItem key={thread.id}>
                            {editingThreadId === thread.id ? (
                              <div className="flex items-center gap-1 px-2 py-1">
                                <Input
                                  ref={inputRef}
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEdit();
                                    if (e.key === "Escape") setEditingThreadId(null);
                                  }}
                                  onBlur={saveEdit}
                                  className="h-7 text-sm"
                                />
                              </div>
                            ) : (
                              <SidebarMenuButton
                                isActive={currentThreadId === thread.id && !isSelectedSpace}
                                onClick={() => onSelectThread?.(thread.id)}
                                tooltip={thread.title}
                                draggable={canDragSpaces}
                                className="h-auto min-h-9 items-start py-1.5"
                                onDragStart={() => setDraggingThreadId(thread.id)}
                                onDragEnd={() => {
                                  setDraggingThreadId(null);
                                  setDragOverSpaceId(null);
                                }}
                              >
                                <ThreadInitialsIcon title={thread.title || "?"} />
                                <div className="flex min-w-0 flex-1 items-center gap-1 group-data-[collapsible=icon]:hidden">
                                  <span className="min-w-0 flex-1 truncate leading-5">
                                    {thread.title || "New Chat"}
                                  </span>
                                  {!isSpaceGrouping && threadSpace(thread) && (
                                    <span
                                      aria-label={`Space: ${threadSpace(thread)!.name}`}
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${spaceColor(threadSpace(thread)!.id)}`}
                                      title={threadSpace(thread)!.name}
                                    />
                                  )}
                                </div>
                                {thread.isArchived && (
                                  <Archive className="ml-auto mt-1 h-3 w-3 opacity-50 group-data-[collapsible=icon]:hidden" />
                                )}
                              </SidebarMenuButton>
                            )}
                            {!editingThreadId && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <SidebarMenuAction showOnHover className="max-md:opacity-100">
                                    <MoreHorizontal />
                                    <span className="sr-only">More</span>
                                  </SidebarMenuAction>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  className="w-48"
                                  side="right"
                                  align="start"
                                >
                                  <DropdownMenuItem onClick={() => startEditing(thread)}>
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    <span>{config.labels?.renameThread || "Rename"}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onArchiveThread?.(thread.id)}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    <span>
                                      {thread.isArchived
                                        ? config.labels?.unarchiveThread || "Unarchive"
                                        : config.labels?.archiveThread || "Archive"}
                                    </span>
                                  </DropdownMenuItem>
                                  {canMoveSpaces && (
                                    <DropdownMenuItem
                                      onClick={() => setSpacePickerThreadId(thread.id)}
                                    >
                                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                                      <span>{config.labels?.moveToSpace || "Move to Space"}</span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteThreadId(thread.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>{config.labels?.deleteThread || "Delete"}</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
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

      {pickerThread && (
        <Dialog
          open={!!spacePickerThreadId}
          onOpenChange={(open) => !open && setSpacePickerThreadId(null)}
        >
          <SpacePickerDialog
            config={config}
            thread={pickerThread}
            spaces={activeSpaces}
            allowCreate={false}
            onMove={onMoveThreadToSpace!}
            onCreate={onCreateSpace}
            onClose={() => setSpacePickerThreadId(null)}
          />
        </Dialog>
      )}

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
              <AlertDialogCancel>{config.labels?.cancel || "Cancel"}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteThreadId && handleDeleteThread(deleteThreadId)}
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
