export type InitializationRunState = Readonly<{
  userId: string | null;
  started: boolean;
  generation: number;
}>;

/** True only while the exact initialization run still owns the hook. */
export const isCurrentInitializationRun = (
  current: InitializationRunState,
  expected: Readonly<{ userId: string; generation: number }>,
  signal: AbortSignal,
): boolean => (
  !signal.aborted &&
  current.started &&
  current.userId === expected.userId &&
  current.generation === expected.generation
);
