import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseServerSentEventStream,
  ServerSentEventParser,
  type ServerSentEvent,
} from '../src/sse.ts';

test('incremental SSE parser handles CRLF splits, comments, ids, retry, and multiline data', () => {
  const events: ServerSentEvent[] = [];
  const parser = new ServerSentEventParser((event) => events.push(event));
  for (const chunk of [
    ': heartbeat\r',
    '\nid: cursor-1\r\nevent: text.delta\r',
    '\nretry: 750\r\ndata: {"text":"hello",\r\n',
    'data: "continued":true}\r\n\r',
    '\n',
  ]) parser.push(chunk);

  assert.deepEqual(events, [{
    event: 'text.delta',
    id: 'cursor-1',
    retry: 750,
    data: '{"text":"hello",\n"continued":true}',
  }]);
});

test('SSE parser drops an unterminated event at EOF', () => {
  const events: ServerSentEvent[] = [];
  const parser = new ServerSentEventParser((event) => events.push(event));
  parser.push('id: cursor-1\ndata: {"partial":true}');
  parser.finish();
  assert.deepEqual(events, []);
});

test('stream parser preserves a UTF-8 code point split across byte chunks', async () => {
  const bytes = new TextEncoder().encode(
    'id: cursor-1\nevent: text.delta\ndata: {"text":"olá 👋"}\n\n',
  );
  const split = bytes.indexOf(0xf0) + 2;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split));
      controller.close();
    },
  });
  const events: ServerSentEvent[] = [];
  await parseServerSentEventStream(body, (event) => events.push(event));
  assert.equal(events[0]?.data, '{"text":"olá 👋"}');
});
