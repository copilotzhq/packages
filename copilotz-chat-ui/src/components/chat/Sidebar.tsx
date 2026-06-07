import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatThread,
  ChatThreadTag,
  ChatUserMenuSection,
} from "../../types/chatTypes";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
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
  Bot,
  ChevronRight,
  Edit2,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
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
    manageTags?: string;
    tags?: string;
    addTag?: string;
    removeTag?: string;
    tagNamePlaceholder?: string;
    untagged?: string;
    groupBy?: string;
    groupByDate?: string;
    groupByTag?: string;
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
    threadTags?: {
      enabled?: boolean;
      groupingEnabled?: boolean;
      defaultGroupBy?: "date" | "tag";
      allowCreate?: boolean;
      allowDrag?: boolean;
    };
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
  onUpdateThreadTags?: (threadId: string, tags: ChatThreadTag[]) => void;
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

type ThreadGroup = {
  key: string;
  label: string;
  tag?: ChatThreadTag;
  threads: ChatThread[];
  muted?: boolean;
};

function slugTagName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "tag";
}

function createThreadTag(name: string): ChatThreadTag {
  return {
    id: `tag_${slugTagName(name)}`,
    name: name.trim(),
  };
}

function mergeThreadTags(
  tags: ChatThreadTag[],
  tag: ChatThreadTag
): ChatThreadTag[] {
  const nameKey = tag.name.trim().toLowerCase();
  if (!nameKey) return tags;
  if (
    tags.some(
      (existing) =>
        existing.id === tag.id || existing.name.trim().toLowerCase() === nameKey
    )
  ) {
    return tags;
  }
  return [...tags, tag];
}

function collectThreadTags(threads: ChatThread[]): ChatThreadTag[] {
  const tags: ChatThreadTag[] = [];
  for (const thread of threads) {
    for (const tag of thread.tags ?? []) {
      if (!tags.some((existing) => existing.id === tag.id)) {
        tags.push(tag);
      }
    }
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}

type TagColor = {
  accent: string;
  background: string;
  border: string;
};

function normalizeTagColorKey(tag: ChatThreadTag): string {
  return (tag.name || tag.id || "tag")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hashTagColorKey(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    red: Math.round((red + match) * 255),
    green: Math.round((green + match) * 255),
    blue: Math.round((blue + match) * 255),
  };
}

function tagColor(tag: ChatThreadTag): TagColor {
  if (tag.color) {
    return {
      accent: tag.color,
      background: `color-mix(in srgb, ${tag.color} 12%, transparent)`,
      border: `color-mix(in srgb, ${tag.color} 24%, transparent)`,
    };
  }

  const hue = hashTagColorKey(normalizeTagColorKey(tag)) % 360;
  const { red, green, blue } = hslToRgb(hue, 0.68, 0.48);

  return {
    accent: `rgb(${red} ${green} ${blue})`,
    background: `rgb(${red} ${green} ${blue} / 0.12)`,
    border: `rgb(${red} ${green} ${blue} / 0.24)`,
  };
}

const TagDot = ({ tag }: { tag: ChatThreadTag }) => {
  const color = tagColor(tag);
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color.accent }}
    />
  );
};

const ThreadTagBadge = ({ tag }: { tag: ChatThreadTag }) => {
  const color = tagColor(tag);
  return (
    <Badge
      variant="secondary"
      className="h-4 max-w-24 gap-1 rounded border px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
      style={{
        backgroundColor: color.background,
        borderColor: color.border,
      }}
    >
      <TagDot tag={tag} />
      <span className="truncate">{tag.name}</span>
    </Badge>
  );
};

const ThreadTagEditorBadge = ({
  tag,
  removeLabel,
  onRemove,
}: {
  tag: ChatThreadTag;
  removeLabel: string;
  onRemove: () => void;
}) => {
  const color = tagColor(tag);
  return (
    <Badge
      variant="secondary"
      className="gap-1 rounded-md border py-1 text-sm font-normal"
      style={{
        backgroundColor: color.background,
        borderColor: color.border,
      }}
    >
      <TagDot tag={tag} />
      {tag.name}
      <button
        type="button"
        className="rounded-sm hover:bg-background/80"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
};

const ThreadTagOptionButton = ({
  tag,
  assigned,
  onClick,
}: {
  tag: ChatThreadTag;
  assigned: boolean;
  onClick: () => void;
}) => {
  const color = tagColor(tag);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={assigned}
      className="gap-1.5 border font-medium disabled:opacity-70"
      style={{
        backgroundColor: color.background,
        borderColor: color.border,
        color: color.accent,
      }}
      onClick={onClick}
    >
      <TagDot tag={tag} />
      {tag.name}
    </Button>
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
  onUpdateThreadTags,
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
  const [tagDialogThreadId, setTagDialogThreadId] = useState<string | null>(
    null
  );
  const [newTagName, setNewTagName] = useState("");
  const [draggingThreadId, setDraggingThreadId] = useState<string | null>(null);
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const inputRef = useRef<HTMLInputElement>(null);
  const threadTagsConfig = config.features?.threadTags;
  const tagsEnabled = !!threadTagsConfig?.enabled;
  const canUpdateTags = tagsEnabled && !!onUpdateThreadTags;
  const canDragTags = canUpdateTags && threadTagsConfig?.allowDrag !== false;
  const [groupBy, setGroupBy] = useState<"date" | "tag">(
    threadTagsConfig?.defaultGroupBy === "tag" ? "tag" : "date"
  );

  // Use the sidebar context to control expansion
  const { setOpen } = useSidebar();

  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingThreadId]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const threadMatchesTitle = (thread: ChatThread) =>
    !normalizedSearchQuery ||
    (thread.title ?? "").toString().toLowerCase().includes(
      normalizedSearchQuery,
    );

  const tagMatchesSearch = (tag: ChatThreadTag) =>
    !normalizedSearchQuery ||
    tag.name.toLowerCase().includes(normalizedSearchQuery) ||
    tag.id.toLowerCase().includes(normalizedSearchQuery);

  const threadMatchesSearch = (thread: ChatThread) =>
    threadMatchesTitle(thread) || (thread.tags ?? []).some(tagMatchesSearch);

  // Filter threads based on search and archive filter
  const filteredThreads = threads.filter((thread) => {
    const matchesArchiveFilter = showArchived || !thread.isArchived;
    return threadMatchesSearch(thread) && matchesArchiveFilter;
  });

  const allTags = useMemo(() => collectThreadTags(threads), [threads]);

  const threadGroups = useMemo((): ThreadGroup[] => {
    if (tagsEnabled && groupBy === "tag") {
      const groups = allTags
        .map((tag) => {
          const tagMatches = tagMatchesSearch(tag);
          return {
            key: tag.id,
            label: tag.name,
            tag,
            threads: filteredThreads.filter((thread) =>
              (thread.tags ?? []).some((threadTag) => threadTag.id === tag.id) &&
              (tagMatches || threadMatchesTitle(thread))
            ),
          };
        })
        .filter((group) => group.threads.length > 0);
      const untagged = filteredThreads.filter(
        (thread) => (thread.tags ?? []).length === 0 &&
          threadMatchesTitle(thread)
      );
      if (untagged.length > 0) {
        groups.push({
          key: "untagged",
          label: config.labels?.untagged || "No tag",
          threads: untagged,
          muted: true,
        });
      }
      return groups;
    }

    const groups: ThreadGroup[] = [];
    const groupMap = new Map<string, ThreadGroup>();
    for (const thread of filteredThreads) {
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

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.threads.push(thread);
      } else {
        const group = { key: groupKey, label: groupKey, threads: [thread] };
        groupMap.set(groupKey, group);
        groups.push(group);
      }
    }
    return groups;
  }, [
    allTags,
    config.labels?.today,
    config.labels?.untagged,
    config.labels?.yesterday,
    filteredThreads,
    groupBy,
    normalizedSearchQuery,
    tagsEnabled,
  ]);

  const tagDialogThread = tagDialogThreadId
    ? threads.find((thread) => thread.id === tagDialogThreadId) ?? null
    : null;

  const toggleGroup = (groupKey: string, open: boolean) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !open,
    }));
  };

  const handleDeleteThread = (threadId: string) => {
    onDeleteThread?.(threadId);
    setDeleteThreadId(null);
  };

  const updateThreadTags = (thread: ChatThread, tags: ChatThreadTag[]) => {
    onUpdateThreadTags?.(thread.id, tags);
  };

  const addTagToThread = (thread: ChatThread, tag: ChatThreadTag) => {
    updateThreadTags(thread, mergeThreadTags(thread.tags ?? [], tag));
  };

  const removeTagFromThread = (thread: ChatThread, tagId: string) => {
    updateThreadTags(
      thread,
      (thread.tags ?? []).filter((tag) => tag.id !== tagId)
    );
  };

  const handleCreateTag = () => {
    if (!tagDialogThread || !newTagName.trim()) return;
    addTagToThread(tagDialogThread, createThreadTag(newTagName));
    setNewTagName("");
  };

  const handleDropOnTag = (tag: ChatThreadTag) => {
    const thread = draggingThreadId
      ? threads.find((candidate) => candidate.id === draggingThreadId)
      : null;
    if (thread) addTagToThread(thread, tag);
    setDraggingThreadId(null);
    setDragOverTagId(null);
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
      <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        {/* Branding / Logo */}
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

        <div className="space-y-3 px-1 group-data-[collapsible=icon]:hidden">
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
                      className="h-11 w-full justify-start gap-2 rounded-xl border border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
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
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 select-none text-sidebar-foreground/45"
            />
            <Input
              className="h-9 rounded-xl border-sidebar-border/80 bg-sidebar pl-3 pr-10 text-sidebar-foreground shadow-sm placeholder:text-sidebar-foreground/50 focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              placeholder={config.labels?.search || "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {tagsEnabled && threadTagsConfig?.groupingEnabled !== false && (
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/70 p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGroupBy("date")}
                className={`h-8 rounded-lg px-2 text-xs font-semibold transition-colors ${
                  groupBy === "date"
                    ? "border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                {config.labels?.groupByDate || "Date"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGroupBy("tag")}
                className={`h-8 rounded-lg px-2 text-xs font-semibold transition-colors ${
                  groupBy === "tag"
                    ? "border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                {config.labels?.groupByTag || "Tag"}
              </Button>
            </div>
          )}
        </div>

        {/* Collapsed View: Search Icon Button (expands sidebar on click) */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center">
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
                ? config.labels?.hideArchived || "Hide Archived"
                : config.labels?.showArchived || "Show Archived"}
            </Button>
          </div>
        )}

        {threadGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground group-data-[collapsible=icon]:hidden">
            <div className="mx-auto h-8 w-8 mb-2 flex items-center justify-center rounded-full bg-muted/50">
              <Plus className="h-4 w-4 opacity-50" />
            </div>
            <p className="text-xs">
              {searchQuery
                ? config.labels?.noThreadsFound || "No conversations found"
                : config.labels?.noThreadsYet || "No conversations yet"}
            </p>
          </div>
        ) : (
          threadGroups.map((group) => {
            const isOpen = !collapsedGroups[group.key];
            return (
              <Collapsible
                key={group.key}
                open={isOpen}
                onOpenChange={(open) => toggleGroup(group.key, open)}
              >
                <SidebarGroup
                  className="mt-1 py-1"
                  onDragOver={(event) => {
                    if (!canDragTags || !group.tag) return;
                    event.preventDefault();
                    setDragOverTagId(group.tag.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverTagId === group.tag?.id) {
                      setDragOverTagId(null);
                    }
                  }}
                  onDrop={(event) => {
                    if (!canDragTags || !group.tag) return;
                    event.preventDefault();
                    handleDropOnTag(group.tag);
                  }}
                >
                  <SidebarGroupLabel
                    asChild
                    className={`h-7 group-data-[collapsible=icon]:hidden ${
                      dragOverTagId === group.tag?.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : ""
                    }`}
                  >
                    <CollapsibleTrigger className="group/trigger w-full">
                      <ChevronRight
                        className={`mr-1 h-3.5 w-3.5 transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                      {group.tag ? (
                        <TagDot tag={group.tag} />
                      ) : group.muted ? (
                        <Tag className="mr-1 h-3.5 w-3.5 opacity-50" />
                      ) : null}
                      <span
                        className={`min-w-0 flex-1 truncate ${
                          group.muted ? "text-muted-foreground" : ""
                        }`}
                      >
                        {group.label}
                      </span>
                      <span className="ml-auto rounded px-1.5 text-[10px] text-muted-foreground">
                        {group.threads.length}
                      </span>
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.threads.map((thread) => {
                          const visibleTags = tagsEnabled
                            ? (thread.tags ?? [])
                                .filter((tag) => tag.id !== group.tag?.id)
                                .slice(0, 2)
                            : [];
                          return (
                            <SidebarMenuItem key={thread.id}>
                              {editingThreadId === thread.id ? (
                                <div className="flex items-center gap-1 px-2 py-1">
                                  <Input
                                    ref={inputRef}
                                    value={editTitle}
                                    onChange={(e) =>
                                      setEditTitle(e.target.value)
                                    }
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
                              ) : (
                                <SidebarMenuButton
                                  isActive={currentThreadId === thread.id}
                                  onClick={() => onSelectThread?.(thread.id)}
                                  tooltip={thread.title}
                                  draggable={canDragTags}
                                  className="h-auto min-h-9 items-start py-1.5"
                                  onDragStart={() =>
                                    setDraggingThreadId(thread.id)}
                                  onDragEnd={() => {
                                    setDraggingThreadId(null);
                                    setDragOverTagId(null);
                                  }}
                                >
                                  <ThreadInitialsIcon
                                    title={thread.title || "?"}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1 group-data-[collapsible=icon]:hidden">
                                    <span className="w-full truncate leading-5">
                                      {thread.title || "New Chat"}
                                    </span>
                                    {visibleTags.length > 0 && (
                                      <span className="flex max-w-full flex-wrap gap-1">
                                        {visibleTags.map((tag) => (
                                          <ThreadTagBadge
                                            key={tag.id}
                                            tag={tag}
                                          />
                                        ))}
                                      </span>
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
                                        {config.labels?.renameThread ||
                                          "Rename"}
                                      </span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        onArchiveThread?.(thread.id)}
                                    >
                                      <Archive className="mr-2 h-4 w-4" />
                                      <span>
                                        {thread.isArchived
                                          ? config.labels?.unarchiveThread ||
                                            "Unarchive"
                                          : config.labels?.archiveThread ||
                                            "Archive"}
                                      </span>
                                    </DropdownMenuItem>
                                    {canUpdateTags && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setTagDialogThreadId(thread.id);
                                          setNewTagName("");
                                        }}
                                      >
                                        <Tag className="mr-2 h-4 w-4" />
                                        <span>
                                          {config.labels?.manageTags ||
                                            "Manage tags"}
                                        </span>
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setDeleteThreadId(thread.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>
                                        {config.labels?.deleteThread ||
                                          "Delete"}
                                      </span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </SidebarMenuItem>
                          );
                        })}
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

      {tagDialogThread && (
        <Dialog
          open={!!tagDialogThread}
          onOpenChange={(open) => {
            if (!open) {
              setTagDialogThreadId(null);
              setNewTagName("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {config.labels?.manageTags || "Manage tags"}
              </DialogTitle>
              <DialogDescription>
                {tagDialogThread.title || "New Chat"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {config.labels?.tags || "Tags"}
                </div>
                {(tagDialogThread.tags ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {config.labels?.untagged || "Untagged"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(tagDialogThread.tags ?? []).map((tag) => (
                      <ThreadTagEditorBadge
                        key={tag.id}
                        tag={tag}
                        removeLabel={config.labels?.removeTag || "Remove tag"}
                        onRemove={() =>
                          removeTagFromThread(tagDialogThread, tag.id)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {allTags.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {config.labels?.addTag || "Add tag"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const assigned = (tagDialogThread.tags ?? []).some(
                        (threadTag) => threadTag.id === tag.id
                      );
                      return (
                        <ThreadTagOptionButton
                          key={tag.id}
                          tag={tag}
                          assigned={assigned}
                          onClick={() => addTagToThread(tagDialogThread, tag)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {threadTagsConfig?.allowCreate !== false && (
                <div className="flex gap-2">
                  <Input
                    value={newTagName}
                    onChange={(event) => setNewTagName(event.target.value)}
                    placeholder={
                      config.labels?.tagNamePlaceholder || "Tag name"
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCreateTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                  >
                    {config.labels?.addTag || "Add tag"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

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
                  deleteThreadId && handleDeleteThread(deleteThreadId)
                }
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
