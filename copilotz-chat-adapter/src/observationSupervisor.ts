import { waitForRetry } from './requestRetry.ts';

/** Owns one thread's observation connection and reconnect backoff. */
export function createObservationSupervisor(options: {
  observe(signal: AbortSignal, progress: () => void): Promise<unknown>;
  retryable(error: unknown): boolean;
  onRetry(): void;
  onError(error: unknown): void;
}) {
  const abort = new AbortController();
  let running = false;
  let terminal = false;
  const start = () => {
    if (running || terminal || abort.signal.aborted) return;
    running = true;
    void (async () => {
      let failures = 0;
      try {
        while (!abort.signal.aborted) {
          try {
            await options.observe(abort.signal, () => {
              failures = 0;
            });
          } catch (error) {
            if (abort.signal.aborted) return;
            if (!options.retryable(error)) {
              terminal = true;
              options.onError(error);
              return;
            }
          }
          if (abort.signal.aborted) return;
          options.onRetry();
          await waitForRetry(
            Math.min(250 * 2 ** Math.min(failures++, 5), 5000),
            abort.signal
          );
        }
      } finally {
        running = false;
      }
    })();
  };
  return {
    start,
    close: () => abort.abort(),
    get active() {
      return running && !terminal && !abort.signal.aborted;
    }
  };
}
