import type { AdminMessage } from "../../api/types";

/** Core history pages are newest-first; the timeline displays oldest-first. */
export function chronologicalHistoryPage(
  page: readonly AdminMessage[]
): AdminMessage[] {
  return [...page].reverse();
}
