import { isTransientRequestError, waitForRetry } from './requestRetry.ts';

/** One thread generation owns its refresh queue, retries, and cancellation. */
export function createHistoryReconciliation<T>(options: {
  signal: AbortSignal;
  load(): Promise<T>;
  apply(value: T): Promise<void>;
  onError(error: unknown): void;
  onRecovered(error: unknown): void;
}) {
  let running = false;
  let dirty = false;
  let lastError: unknown;
  const request = () => {
    if (options.signal.aborted) return;
    dirty = true;
    if (running) return;
    running = true;
    void (async () => {
      let failures = 0;
      try {
        while (dirty && !options.signal.aborted) {
          dirty = false;
          let applying = false;
          try {
            const value = await options.load();
            if (options.signal.aborted) return;
            applying = true;
            await options.apply(value);
            if (options.signal.aborted) return;
            failures = 0;
            if (lastError !== undefined) options.onRecovered(lastError);
            lastError = undefined;
          } catch (error) {
            if (options.signal.aborted) return;
            lastError = error;
            options.onError(error);
            if (
              applying ||
              !isTransientRequestError(error) ||
              ++failures >= 3
            ) {
              return; // A later event or explicit refresh may trigger another pass.
            }
            dirty = true;
            await waitForRetry(100 * 2 ** (failures - 1), options.signal);
          }
        }
      } finally {
        running = false;
        if (dirty && !options.signal.aborted) request();
      }
    })();
  };
  return { request };
}
