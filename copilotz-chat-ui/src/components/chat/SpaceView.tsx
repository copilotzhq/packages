import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronRight,
  FileText,
  MessageSquare,
  Pencil,
  Users,
} from "lucide-react";
import type {
  ChatSpace,
  ChatSpaceMember,
  ChatSpaceSection,
  ChatSpaceSectionContext,
  ChatSpaceSectionId,
  ChatSpaceViewData,
  SpaceCollection,
  ChatThread,
} from "../../types/chatTypes";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { SpaceResourceList, SpaceResourceRow, SpaceResourceToolbar } from "./SpaceResources";

export type SpaceUpdate = { name?: string; description?: string };

export interface SpaceViewProps {
  space: ChatSpace;
  sections?: readonly ChatSpaceSection[];
  selectedSection?: ChatSpaceSectionId;
  defaultSelectedSection?: ChatSpaceSectionId;
  onSectionChange?: (sectionId: ChatSpaceSectionId) => void;
  data?: ChatSpaceViewData;
  canEditSpace?: boolean;
  onUpdateSpace?: (
    patch: SpaceUpdate,
  ) => ChatSpace | void | Promise<ChatSpace | void>;
  onOpenConversation?: (threadId: string) => void;
  onRefresh?: () => void | Promise<void>;
  canManageMembers?: boolean;
  onAddMember?: (email: string) => void | Promise<void>;
  onRemoveMember?: (memberId: string) => void | Promise<void>;
  onClose?: () => void;
  className?: string;
}

const builtInSections = (
  data: ChatSpaceViewData | undefined,
): ChatSpaceSection[] => {
  const sections: ChatSpaceSection[] = [
    { id: "overview", label: "Overview", icon: <FileText className="h-4 w-4" /> },
  ];
  if (data?.conversations) {
    sections.push({
      id: "conversations",
      label: "Chats",
      icon: <MessageSquare className="h-4 w-4" />,
    });
  }
  if (data?.members) {
    sections.push({
      id: "members",
      label: "Members",
      icon: <Users className="h-4 w-4" />,
    });
  }
  return sections;
};

function CollectionState<T>({
  collection,
  noun,
  children,
}: {
  collection?: SpaceCollection<T>;
  noun: string;
  children: (items: readonly T[]) => React.ReactNode;
}) {
  if (!collection) return null;
  if (collection.status === "loading") {
    return <SpaceResourceList loading loadingLabel={`Loading ${noun.toLowerCase()}…`} />;
  }
  if (collection.status === "unavailable") {
    return <SpaceResourceList empty emptyMessage={`${noun} are not available for this Space.`} />;
  }
  if (collection.status === "error") {
    return <SpaceResourceList error={collection.error || `Unable to load ${noun.toLowerCase()}.`} />;
  }
  const items = collection.items ?? [];
  return (
    <div className="space-y-3">
      {collection.status === "partial" && (
        <p className="text-xs text-muted-foreground">
          Showing the available {noun.toLowerCase()}; this list is not exhaustive.
        </p>
      )}
      <SpaceResourceList empty={collection.status === "empty" || items.length === 0} emptyMessage={`No ${noun.toLowerCase()} yet.`}>
        {children(items as readonly T[])}
      </SpaceResourceList>
      {collection.hasMore && collection.onLoadMore && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => void collection.onLoadMore?.()}
        >
          Load more {noun.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

function ConversationList({
  items,
  onOpen,
}: {
  items: readonly ChatThread[];
  onOpen?: (threadId: string) => void;
}) {
  return (
    <>
      {items.map((thread) => (
        <SpaceResourceRow
          key={thread.id}
          title={thread.title || "Chat"}
          onOpen={onOpen ? () => onOpen(thread.id) : undefined}
          openLabel="Open chat"
        />
      ))}
    </>
  );
}

function ConversationSection({
  collection,
  onOpen,
  onRefresh,
}: {
  collection?: SpaceCollection<ChatThread>;
  onOpen?: (threadId: string) => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const items = collection?.items?.filter((thread) =>
    (thread.title || "Chat").toLowerCase().includes(search.trim().toLowerCase())
  );
  const visibleCollection = collection && items
    ? { ...collection, items, status: items.length ? collection.status : "empty" as const }
    : collection;
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <SpaceResourceToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchLabel="Search Chats"
        searchPlaceholder="Search Chats"
        onRefresh={onRefresh ? () => void onRefresh() : undefined}
        refreshLabel="Refresh Chats"
      />
      <CollectionState<ChatThread> collection={visibleCollection} noun="Chats">
        {(items) => <ConversationList items={items} onOpen={onOpen} />}
      </CollectionState>
    </div>
  );
}

function MemberList({
  items,
  canManage,
  onRemove,
}: {
  items: readonly ChatSpaceMember[];
  canManage?: boolean;
  onRemove?: (memberId: string) => void | Promise<void>;
}) {
  return (
    <>
      {items.map((member) => {
        const displayName = member.name || member.id;
        const isOwner = member.role?.toLowerCase() === "owner";
        return (
          <SpaceResourceRow
            key={member.id}
            title={displayName}
            subtitle={member.email}
            rightLabel={member.role}
            actions={canManage && onRemove && !isOwner ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                aria-label={`Remove ${displayName}`}
                onClick={() => void onRemove(member.id)}
              >
                Remove
              </Button>
            ) : undefined}
          />
        );
      })}
    </>
  );
}

export const SpaceView: React.FC<SpaceViewProps> = ({
  space,
  sections: suppliedSections,
  selectedSection,
  defaultSelectedSection = "overview",
  onSectionChange,
  data,
  canEditSpace,
  onUpdateSpace,
  onOpenConversation,
  onRefresh,
  canManageMembers,
  onAddMember,
  onRemoveMember,
  onClose,
  className = "",
}) => {
  const sections = useMemo(
    () => (suppliedSections ? [...suppliedSections] : builtInSections(data)),
    [data, suppliedSections],
  );
  const firstSection = sections[0]?.id ?? "overview";
  const [internalSection, setInternalSection] = useState<ChatSpaceSectionId>(
    sections.some((section) => section.id === defaultSelectedSection)
      ? defaultSelectedSection
      : firstSection,
  );
  const activeSection = selectedSection ?? internalSection;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberWorking, setMemberWorking] = useState(false);
  const activeSpaceId = useRef(space.id);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const tabNavRef = useRef<HTMLElement>(null);
  const saveOperation = useRef(0);
  const addMemberOperation = useRef(0);
  const removeMemberOperation = useRef(0);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  useEffect(() => {
    activeSpaceId.current = space.id;
    setName(space.name);
    setDescription(space.description ?? "");
    setEditing(false);
    setError(null);
    setMemberEmail("");
    setMemberSearch("");
    setMemberDialogOpen(false);
    setSaving(false);
    setMemberWorking(false);
    saveOperation.current += 1;
    addMemberOperation.current += 1;
    removeMemberOperation.current += 1;
    setInternalSection(
      sections.some((candidate) => candidate.id === defaultSelectedSection)
        ? defaultSelectedSection
        : firstSection,
    );
  }, [space.id]);

  const chooseSection = (sectionId: ChatSpaceSectionId) => {
    if (selectedSection === undefined) setInternalSection(sectionId);
    onSectionChange?.(sectionId);
  };

  const save = async () => {
    if (!onUpdateSpace || !name.trim() || saving) return;
    const savingSpaceId = space.id;
    const operation = ++saveOperation.current;
    setSaving(true);
    setError(null);
    try {
      const result = await onUpdateSpace({
        name: name.trim(),
        description: description.trim(),
      });
      if (activeSpaceId.current !== savingSpaceId || saveOperation.current !== operation) return;
      if (result) {
        setName(result.name);
        setDescription(result.description ?? "");
      }
      setEditing(false);
    } catch (cause) {
      if (activeSpaceId.current !== savingSpaceId || saveOperation.current !== operation) return;
      setError(cause instanceof Error ? cause.message : "The Space could not be updated.");
    } finally {
      if (activeSpaceId.current === savingSpaceId && saveOperation.current === operation) {
        setSaving(false);
      }
    }
  };

  const beginEdit = () => {
    setName(space.name);
    setDescription(space.description ?? "");
    setError(null);
    setEditing(true);
  };

  const context: ChatSpaceSectionContext = { space, onOpenConversation };
  const canEdit = canEditSpace ?? space.permissions?.canEdit === true;
  const canManage = canManageMembers ?? space.permissions?.canManageMembers === true;
  const section = sections.find((candidate) => candidate.id === activeSection) ?? sections[0];
  const resolvedActiveSection = section?.id;
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [resolvedActiveSection]);
  useEffect(() => {
    const nav = tabNavRef.current;
    if (!nav) return;
    const updateOverflow = () => {
      setCanScrollTabsRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    };
    updateOverflow();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateOverflow);
    observer?.observe(nav);
    window.addEventListener("resize", updateOverflow);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [sections]);
  const builtInContent = section?.id === "overview"
    ? (
      <div className="space-y-5">
        {editing ? (
          <div className="space-y-3">
            <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Space name" disabled={saving} />
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Space description" disabled={saving} />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={() => void save()} disabled={saving || !name.trim()}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {space.description ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="prose prose-sm max-w-none text-muted-foreground"
              >
                {space.description}
              </ReactMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">No description</p>
            )}
            {canEdit && onUpdateSpace && (
              <Button type="button" variant="outline" onClick={beginEdit}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Edit Space
              </Button>
            )}
          </div>
        )}
      </div>
    )
    : section?.id === "conversations"
    ? <ConversationSection collection={data?.conversations} onOpen={onOpenConversation} onRefresh={onRefresh} />
    : null;
  const customContent = section?.content
    ? typeof section.content === "function" ? section.content(context) : section.content
    : null;
  const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = memberEmail.trim();
    if (!email || memberWorking || !onAddMember) return;
    const addingSpaceId = space.id;
    const operation = ++addMemberOperation.current;
    setError(null);
    setMemberWorking(true);
    try {
      await onAddMember(email);
      if (activeSpaceId.current === addingSpaceId && addMemberOperation.current === operation) {
        setMemberEmail("");
        setMemberDialogOpen(false);
      }
    } catch (cause) {
      if (activeSpaceId.current === addingSpaceId && addMemberOperation.current === operation) {
        setError(cause instanceof Error ? cause.message : "The member could not be added.");
      }
    } finally {
      if (activeSpaceId.current === addingSpaceId && addMemberOperation.current === operation) {
        setMemberWorking(false);
      }
    }
  };
  const memberContent = section?.id === "members"
    ? (
      <div className="mx-auto max-w-4xl space-y-3">
        {error && !memberDialogOpen && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <SpaceResourceToolbar
          searchValue={memberSearch}
          onSearchChange={setMemberSearch}
          searchLabel="Search Members"
          searchPlaceholder="Search Members"
          onCreate={canManage && onAddMember ? () => setMemberDialogOpen(true) : undefined}
          createLabel="Add Member"
          onRefresh={onRefresh ? () => void onRefresh() : undefined}
          refreshLabel="Refresh Members"
        />
        <Dialog open={memberDialogOpen} onOpenChange={(open) => { if (!memberWorking) setMemberDialogOpen(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Member</DialogTitle>
              <DialogDescription>Enter the email address of a user in this tenant.</DialogDescription>
            </DialogHeader>
            {canManage && onAddMember && (
              <form className="space-y-3" onSubmit={handleAddMember}>
                <Input
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  type="email"
                  placeholder="Email address"
                  aria-label="Email"
                  disabled={memberWorking}
                />
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit" disabled={!memberEmail.trim() || memberWorking}>Add</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <CollectionState<ChatSpaceMember>
          collection={data?.members && {
            ...data.members,
            items: data.members.items?.filter((member) =>
              `${member.name ?? ""} ${member.email ?? ""}`.toLowerCase().includes(memberSearch.trim().toLowerCase())
            ),
          }}
          noun="Members"
        >
          {(items) => (
            <MemberList
              items={items}
              canManage={canManage}
              onRemove={onRemoveMember ? async (id) => {
                const removingSpaceId = space.id;
                const operation = ++removeMemberOperation.current;
                setError(null);
                try {
                  await onRemoveMember(id);
                } catch (cause) {
                  if (activeSpaceId.current === removingSpaceId && removeMemberOperation.current === operation) {
                    setError(cause instanceof Error ? cause.message : "The member could not be removed.");
                  }
                }
              } : undefined}
            />
          )}
        </CollectionState>
      </div>
    )
    : null;
  const resolvedBuiltInContent = memberContent ?? builtInContent;

  return (
    <section className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`} aria-label={`${space.name || space.id} Space`}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-4 py-2 sm:px-6">
          <h1 className="truncate text-sm font-semibold">{space.name || space.id}</h1>
        </div>
        <div
          className={`order-1 min-h-0 flex-1 sm:order-2 ${
            customContent ? "overflow-hidden" : "overflow-y-auto p-4 sm:p-6"
          }`}
          role="tabpanel"
        >
          {customContent ?? resolvedBuiltInContent}
        </div>
        <div className="relative order-2 shrink-0 border-t pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:order-1 sm:border-t-0 sm:border-b sm:pb-0">
          <nav
            ref={tabNavRef}
            className="flex gap-1 overflow-x-auto px-3 pt-2 sm:px-5 sm:py-2"
            aria-label="Space sections"
            role="tablist"
            onScroll={(event) => {
              const nav = event.currentTarget;
              setCanScrollTabsRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
            }}
            onKeyDown={(event) => {
              const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const index = tabs.indexOf(event.target as HTMLButtonElement);
              if (index < 0) return;
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                : event.key === "Home" ? 0
                : event.key === "End" ? tabs.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              tabs[next]?.focus();
              tabs[next]?.click();
            }}
          >
            {sections.map((candidate) => (
              <button
                type="button"
                role="tab"
                aria-selected={candidate.id === resolvedActiveSection}
                tabIndex={candidate.id === resolvedActiveSection ? 0 : -1}
                key={candidate.id}
                ref={candidate.id === resolvedActiveSection ? activeTabRef : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${candidate.id === resolvedActiveSection ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                onClick={() => chooseSection(candidate.id)}
              >
                {candidate.icon}
                {candidate.label}
              </button>
            ))}
          </nav>
          {canScrollTabsRight && (
            <>
              <div className="pointer-events-none absolute inset-y-0 right-8 w-8 bg-gradient-to-l from-background to-transparent" aria-hidden="true" />
              <button
                type="button"
                className="absolute right-1 top-1/2 flex h-8 -translate-y-1/2 items-center rounded-md bg-background/95 px-1 text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Show more Space sections"
                onClick={() => {
                  const nav = tabNavRef.current;
                  if (nav) nav.scrollBy({ left: Math.max(120, nav.clientWidth * 0.75), behavior: "smooth" });
                }}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">More Space sections</span>
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
