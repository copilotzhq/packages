import type { ChatSpace, ChatThread } from "../types/chatTypes";

export type SpaceThreadGroup = Readonly<{
  key: string;
  label: string;
  spaceId: string | null;
  space?: ChatSpace;
  unavailable?: boolean;
  threads: readonly ChatThread[];
}>;

/**
 * Groups every conversation into exactly one Space bucket. A missing or stale
 * Space attachment is kept in a visible unavailable bucket when its Space is
 * absent or archived. Only a thread with no spaceId belongs to No Space.
 */
export function groupThreadsBySpace(
  threads: readonly ChatThread[],
  spaces: readonly ChatSpace[],
  noSpaceLabel = "No Space",
): SpaceThreadGroup[] {
  type MutableGroup = {
    key: string;
    label: string;
    spaceId: string | null;
    space?: ChatSpace;
    unavailable?: boolean;
    threads: ChatThread[];
  };
  const groups: MutableGroup[] = [];
  const unavailable = new Map<string, MutableGroup>();
  const bySpaceId = new Map<string, MutableGroup>();
  for (const space of spaces) {
    const group: MutableGroup = {
      key: `space:${space.id}`,
      label: space.name || space.id,
      spaceId: space.id,
      space,
      threads: [],
    };
    bySpaceId.set(space.id, group);
    if (space.status !== "archived") groups.push(group);
    else {
      group.key = `space:archived:${space.id}`;
      group.label = `${space.name || space.id} (Archived)`;
      group.unavailable = true;
    }
  }
  const spaceless: ChatThread[] = [];
  for (const thread of threads) {
    if (!thread.spaceId) {
      spaceless.push(thread);
      continue;
    }
    const group = bySpaceId.get(thread.spaceId);
    if (group) {
      if (group.unavailable && !unavailable.has(group.key)) {
        unavailable.set(group.key, group);
      }
      group.threads.push(thread);
      continue;
    }
    const key = `space:unavailable:${thread.spaceId}`;
    let unavailableGroup = unavailable.get(key);
    if (!unavailableGroup) {
      unavailableGroup = {
        key,
        label: `Unavailable Space (${thread.spaceId})`,
        spaceId: thread.spaceId,
        unavailable: true,
        threads: [],
      };
      bySpaceId.set(thread.spaceId, unavailableGroup);
      unavailable.set(key, unavailableGroup);
    }
    unavailableGroup.threads.push(thread);
  }
  groups.push(...unavailable.values());
  if (spaceless.length) {
    groups.push({
      key: "space:none",
      label: noSpaceLabel,
      spaceId: null,
      threads: spaceless,
    });
  }
  return groups;
}
