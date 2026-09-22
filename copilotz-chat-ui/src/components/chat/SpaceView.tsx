import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Loader2,
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
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

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
  canManageMembers?: boolean;
  onAddMember?: (memberId: string) => void | Promise<void>;
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
      label: "Conversations",
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
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading {noun}…
      </div>
    );
  }
  if (collection.status === "unavailable") {
    return <p className="p-6 text-sm text-muted-foreground">{noun} are not available for this Space.</p>;
  }
  if (collection.status === "error") {
    return (
      <p className="p-6 text-sm text-destructive" role="alert">
        {collection.error || `Unable to load ${noun.toLowerCase()}.`}
      </p>
    );
  }
  const items = collection.items ?? [];
  if (collection.status === "empty" || items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">No {noun.toLowerCase()} yet.</p>;
  }
  return (
    <>
      {collection.status === "partial" && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing the available {noun.toLowerCase()}; this list is not exhaustive.
        </p>
      )}
      {children(items as readonly T[])}
      {collection.hasMore && collection.onLoadMore && (
        <Button
          type="button"
          variant="ghost"
          className="mt-3"
          onClick={() => void collection.onLoadMore?.()}
        >
          Load more {noun.toLowerCase()}
        </Button>
      )}
    </>
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
    <div className="max-w-2xl overflow-hidden rounded-lg border">
      {items.map((thread) => (
        <button
          type="button"
          key={thread.id}
          className="flex min-h-9 w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpen?.(thread.id)}
          disabled={!onOpen}
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm">{thread.title || "Conversation"}</span>
        </button>
      ))}
    </div>
  );
}

function ConversationSection({
  collection,
  onOpen,
}: {
  collection?: SpaceCollection<ChatThread>;
  onOpen?: (threadId: string) => void;
}) {
  const count = collection?.items?.length ?? 0;
  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Conversations</h2>
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? "conversation" : "conversations"}
          </p>
        </div>
      </div>
      <CollectionState<ChatThread> collection={collection} noun="Conversations">
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
    <div className="divide-y rounded-lg border">
      {items.map((member) => (
        <div key={member.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {(member.name || member.id).slice(0, 2).toUpperCase()}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">{member.name || member.id}</span>
          {member.role && <span className="text-xs text-muted-foreground">{member.role}</span>}
          {canManage && onRemove && (
            <button
              type="button"
              className="text-xs text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void onRemove(member.id)}
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
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
  const [memberId, setMemberId] = useState("");
  const [memberWorking, setMemberWorking] = useState(false);
  const activeSpaceId = useRef(space.id);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const saveOperation = useRef(0);
  const addMemberOperation = useRef(0);
  const removeMemberOperation = useRef(0);

  useEffect(() => {
    activeSpaceId.current = space.id;
    setName(space.name);
    setDescription(space.description ?? "");
    setEditing(false);
    setError(null);
    setMemberId("");
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
            <h2 className="text-xl font-semibold">{space.name || space.id}</h2>
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
      ? <ConversationSection collection={data?.conversations} onOpen={onOpenConversation} />
    : null;
  const customContent = section?.content
    ? typeof section.content === "function" ? section.content(context) : section.content
    : null;
  const memberContent = section?.id === "members"
    ? (
      <div>
        {error && <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>}
        {canManage && onAddMember && (
          <form
            className="mb-4 flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const id = memberId.trim();
              if (!id || memberWorking) return;
              const addingSpaceId = space.id;
              const operation = ++addMemberOperation.current;
              setError(null);
              setMemberWorking(true);
              try {
                await onAddMember(id);
                if (activeSpaceId.current === addingSpaceId && addMemberOperation.current === operation) setMemberId("");
              } catch (cause) {
                if (activeSpaceId.current === addingSpaceId && addMemberOperation.current === operation) {
                  setError(cause instanceof Error ? cause.message : "The member could not be added.");
                }
              } finally {
                if (activeSpaceId.current === addingSpaceId && addMemberOperation.current === operation) {
                  setMemberWorking(false);
                }
              }
            }}
          >
            <Input
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              placeholder="Member id"
              aria-label="Member id"
              disabled={memberWorking}
            />
            <Button type="submit" disabled={!memberId.trim() || memberWorking}>Add</Button>
          </form>
        )}
        <CollectionState<ChatSpaceMember> collection={data?.members} noun="Members">
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
        <div className="order-1 min-h-0 flex-1 overflow-y-auto p-4 sm:order-2 sm:p-6" role="tabpanel">
          {customContent ?? resolvedBuiltInContent}
        </div>
        <nav
          className="order-2 flex shrink-0 gap-1 overflow-x-auto border-t px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:order-1 sm:border-t-0 sm:border-b sm:px-5 sm:py-2"
          aria-label="Space sections"
          role="tablist"
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
      </div>
    </section>
  );
};
