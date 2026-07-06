import type { AdminModule } from "../core/types";
import { agentsModule } from "./agents";
import { collectionsModule } from "./collections";
import { eventsModule } from "./events";
import { overviewModule } from "./overview";
import { participantsModule } from "./participants";
import { threadsModule } from "./threads";
import { usageModule } from "./usage";

export function defaultCopilotzModules(): AdminModule[] {
  return [
    overviewModule(),
    usageModule(),
    eventsModule(),
    threadsModule(),
    agentsModule(),
    participantsModule(),
    collectionsModule(),
  ];
}

export { agentsModule } from "./agents";
export { collectionsModule } from "./collections";
export { eventsModule } from "./events";
export { overviewModule } from "./overview";
export { participantsModule } from "./participants";
export { threadsModule } from "./threads";
export { usageModule } from "./usage";
export * from "./usage/calculations";
export type * from "./usage/types";
