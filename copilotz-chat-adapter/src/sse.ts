export type ServerSentEvent = Readonly<{
  event: string;
  data: string;
  id?: string;
  retry?: number;
}>;

/**
 * Incremental WHATWG event-stream parser. It deliberately does not advance a
 * reconnect cursor itself: callers do that only after applying the event.
 */
export class ServerSentEventParser {
  readonly #onEvent: (event: ServerSentEvent) => void;
  #buffer = '';
  #event = '';
  #data: string[] = [];
  #id: string | undefined;
  #retry: number | undefined;

  constructor(onEvent: (event: ServerSentEvent) => void) {
    this.#onEvent = onEvent;
  }

  push(chunk: string): void {
    if (!chunk) return;
    this.#buffer += chunk;
    this.#drainLines(false);
  }

  /** Flushes decoding state but intentionally drops an unterminated event. */
  finish(): void {
    this.#drainLines(true);
    this.#buffer = '';
    this.#resetEvent();
  }

  #drainLines(atEof: boolean): void {
    while (this.#buffer.length > 0) {
      let boundary = -1;
      for (let index = 0; index < this.#buffer.length; index += 1) {
        const char = this.#buffer.charCodeAt(index);
        if (char === 10 || char === 13) {
          boundary = index;
          break;
        }
      }
      if (boundary < 0) {
        if (atEof) {
          this.#processLine(this.#buffer);
          this.#buffer = '';
        }
        return;
      }
      if (
        this.#buffer.charCodeAt(boundary) === 13 &&
        boundary === this.#buffer.length - 1 &&
        !atEof
      ) {
        return;
      }
      const line = this.#buffer.slice(0, boundary);
      const width = this.#buffer.charCodeAt(boundary) === 13 &&
          this.#buffer.charCodeAt(boundary + 1) === 10
        ? 2
        : 1;
      this.#buffer = this.#buffer.slice(boundary + width);
      this.#processLine(line);
    }
  }

  #processLine(line: string): void {
    if (line === '') {
      this.#dispatch();
      return;
    }
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') {
      this.#event = value;
    } else if (field === 'data') {
      this.#data.push(value);
    } else if (field === 'id' && !value.includes('\0')) {
      this.#id = value;
    } else if (field === 'retry' && /^\d+$/.test(value)) {
      const retry = Number(value);
      if (Number.isSafeInteger(retry)) this.#retry = retry;
    }
  }

  #dispatch(): void {
    if (this.#data.length === 0) {
      this.#resetEvent();
      return;
    }
    this.#onEvent(Object.freeze({
      event: this.#event || 'message',
      data: this.#data.join('\n'),
      ...(this.#id !== undefined ? { id: this.#id } : {}),
      ...(this.#retry !== undefined ? { retry: this.#retry } : {}),
    }));
    this.#resetEvent();
  }

  #resetEvent(): void {
    this.#event = '';
    this.#data = [];
    this.#id = undefined;
    this.#retry = undefined;
  }
}

export const parseServerSentEventStream = async (
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ServerSentEvent) => void | Promise<void>,
  onBytes?: () => void,
): Promise<void> => {
  const pending: ServerSentEvent[] = [];
  const parser = new ServerSentEventParser((event) => pending.push(event));
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      onBytes?.();
      parser.push(decoder.decode(next.value, { stream: true }));
      while (pending.length > 0) await onEvent(pending.shift()!);
    }
    parser.push(decoder.decode());
    while (pending.length > 0) await onEvent(pending.shift()!);
    parser.finish();
  } finally {
    reader.releaseLock();
  }
};
