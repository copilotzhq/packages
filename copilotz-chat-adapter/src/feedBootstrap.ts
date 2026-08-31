export type AcceptedOperationFeedCursorOptions = Readonly<{
  activeOperationIds: Iterable<string>;
  acceptedOperationId: string;
  currentCursor: string | null;
  receiptCursor: string;
}>;

/**
 * Selects the cursor used to attach after accepting a new operation.
 *
 * A receipt cursor is authoritative for a sole newly accepted operation. When
 * other operations are already active, the current compound feed cursor must
 * remain authoritative so their independent positions are not discarded.
 */
export const selectAcceptedOperationFeedCursor = ({
  activeOperationIds,
  acceptedOperationId,
  currentCursor,
  receiptCursor,
}: AcceptedOperationFeedCursorOptions): string => {
  const activeIds = new Set(
    [...activeOperationIds]
      .map((operationId) => operationId.trim())
      .filter(Boolean),
  );
  const normalizedAcceptedId = acceptedOperationId.trim();
  if (
    activeIds.size === 1 && normalizedAcceptedId &&
    activeIds.has(normalizedAcceptedId)
  ) {
    return receiptCursor;
  }
  return currentCursor ?? receiptCursor;
};
