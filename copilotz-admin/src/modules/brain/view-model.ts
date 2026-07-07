import type {
  AdminBrainFilters,
  AdminBrainRelated,
} from "../../api/types";

export type AdminBrainView = "entities" | "knowledge" | "work" | "map" | "all";

export type AdminBrainRelationGroupId =
  | "decisions"
  | "facts"
  | "tasks"
  | "preferences"
  | "constraints"
  | "risks"
  | "openQuestions"
  | "currentState"
  | "entities"
  | "other";

export interface AdminBrainRelationGroup {
  id: AdminBrainRelationGroupId;
  label: string;
  description: string;
  items: AdminBrainRelated[];
}

export const ENTITY_FOCUS_RELATION_TYPES = [
  "mentions",
  "related_to",
  "supports",
  "depends_on",
  "contradicts",
  "supersedes",
] as const;

export const BRAIN_VIEW_LABELS: Record<AdminBrainView, string> = {
  entities: "Entities",
  knowledge: "Knowledge",
  work: "Work",
  map: "Map",
  all: "All nodes",
};

export const BRAIN_RELATION_GROUP_DEFINITIONS: Array<
  Omit<AdminBrainRelationGroup, "items"> & { kinds: string[] }
> = [
  {
    id: "decisions",
    label: "Decisions",
    description: "Durable choices connected to this entity.",
    kinds: ["decision"],
  },
  {
    id: "facts",
    label: "Facts",
    description: "Known statements and observations.",
    kinds: ["fact"],
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Actions, next steps, and execution work.",
    kinds: ["task", "next_action"],
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Remembered user, org, or agent preferences.",
    kinds: ["preference"],
  },
  {
    id: "constraints",
    label: "Constraints",
    description: "Limits, rules, and requirements.",
    kinds: ["constraint"],
  },
  {
    id: "risks",
    label: "Risks",
    description: "Known risks or possible failures.",
    kinds: ["risk"],
  },
  {
    id: "openQuestions",
    label: "Open questions",
    description: "Questions that still need resolution.",
    kinds: ["open_question"],
  },
  {
    id: "currentState",
    label: "Current state",
    description: "Shorter-term context, challenges, and active state.",
    kinds: ["current_state", "challenge"],
  },
  {
    id: "entities",
    label: "Other entities",
    description: "Neighboring people, systems, projects, or concepts.",
    kinds: ["entity"],
  },
  {
    id: "other",
    label: "Other",
    description: "Related nodes that do not fit a standard Brain kind yet.",
    kinds: [],
  },
];

const GROUP_BY_KIND = new Map<string, AdminBrainRelationGroupId>(
  BRAIN_RELATION_GROUP_DEFINITIONS.flatMap((group) =>
    group.kinds.map((kind) => [kind, group.id] as const)
  ),
);

export function getBrainViewBaseFilters(
  view: AdminBrainView,
): Pick<AdminBrainFilters, "kind" | "layer"> {
  if (view === "entities") {
    return { kind: "entity", layer: "knowledge" };
  }
  if (view === "knowledge") {
    return { kind: "all", layer: "knowledge" };
  }
  if (view === "work") {
    return { kind: "all", layer: "working" };
  }
  return { kind: "all", layer: "all" };
}

export function isEntityBrainView(view: AdminBrainView): boolean {
  return view === "entities";
}

export function groupBrainRelationsByKind(
  related: AdminBrainRelated[],
): AdminBrainRelationGroup[] {
  const groups = BRAIN_RELATION_GROUP_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    items: [] as AdminBrainRelated[],
  }));
  const byId = new Map(groups.map((group) => [group.id, group]));

  for (const item of related) {
    const groupId = GROUP_BY_KIND.get(item.node.kind) ?? "other";
    byId.get(groupId)?.items.push(item);
  }

  return groups.filter((group) => group.items.length > 0);
}

export function getKnowledgeRelationGroups(
  related: AdminBrainRelated[],
): AdminBrainRelationGroup[] {
  const knowledgeGroupIds: AdminBrainRelationGroupId[] = [
    "decisions",
    "facts",
    "preferences",
    "constraints",
  ];
  return groupBrainRelationsByKind(related).filter((group) =>
    knowledgeGroupIds.includes(group.id)
  );
}

export function getWorkRelationGroups(
  related: AdminBrainRelated[],
): AdminBrainRelationGroup[] {
  const workGroupIds: AdminBrainRelationGroupId[] = [
    "tasks",
    "risks",
    "openQuestions",
    "currentState",
  ];
  return groupBrainRelationsByKind(related).filter((group) =>
    workGroupIds.includes(group.id)
  );
}
