/** Cancels superseded reads and fences sources that ignore AbortSignal. */
export function latestRequest() {
  let generation = 0;
  let controller: AbortController | undefined;
  return {
    start() {
      controller?.abort();
      controller = new AbortController();
      const current = ++generation;
      const signal = controller.signal;
      return {
        signal,
        isCurrent: () => current === generation && !signal.aborted,
      };
    },
    cancel() {
      generation++;
      controller?.abort();
    },
  };
}
