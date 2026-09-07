/** Retry only network failures and explicitly transient HTTP responses. */
export function isTransientRequestError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, name } = error as { status?: number; name?: string };
  if (typeof status === 'number') {
    return status === 408 || status === 429 || status >= 500;
  }
  return (
    name === 'TransportError' ||
    name === 'TruncatedObservationError' ||
    name === 'TypeError'
  );
}

export function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

/** Bootstrap reads retry transient transport failures, never validation or policy errors. */
export async function retryRead<T>(
  read: () => Promise<T>,
  signal: AbortSignal
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await read();
    } catch (error) {
      if (signal.aborted || !isTransientRequestError(error) || attempt >= 2) {
        throw error;
      }
      await waitForRetry(100 * 2 ** attempt, signal);
    }
  }
}
