import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const transcribers = [];
const pendingTranscriberStarts = [];

class FakeTranscriber {
  constructor(model, callbacks) {
    this.model = model;
    this.callbacks = callbacks;
    this.isActive = false;
    this.stream = null;
    transcribers.push(this);
  }

  attachStream(stream) {
    this.stream = stream;
  }

  async start() {
    const pendingStart = pendingTranscriberStarts.shift();
    if (pendingStart) {
      await pendingStart;
    }
    this.isActive = true;
    this.callbacks.onTranscribeStarted?.();
  }

  stop() {
    this.isActive = false;
    this.callbacks.onTranscribeStopped?.();
  }

  emitSpeechStart() {
    this.callbacks.onSpeechStart?.();
  }

  emitSpeechEnd() {
    this.callbacks.onSpeechEnd?.();
  }

  emitCommit(text, buffer) {
    this.callbacks.onTranscriptionCommitted?.(text, buffer);
  }
}

mock.module('@moonshine-ai/moonshine-js', {
  namedExports: {
    Settings: { VERBOSE_LOGGING: false },
    Transcriber: FakeTranscriber,
  },
});

const { createMoonshineVoiceProvider } = await import('../src/index.ts');

let streams;
let getUserMedia;

const createStream = () => {
  const track = { stop: mock.fn() };
  const stream = { getTracks: () => [track] };
  streams.push({ stream, track });
  return stream;
};

class FakeMediaRecorder {
  static deferStops = false;
  static pendingStops = [];

  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.mimeType = 'audio/webm';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
    this.payload = 'audio';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    if (FakeMediaRecorder.deferStops) {
      FakeMediaRecorder.pendingStops.push(this);
      return;
    }
    this.finishStop();
  }

  finishStop() {
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob([this.payload], { type: this.mimeType }) });
      this.onstop?.();
    });
  }
}

const installBrowser = (getStream = async () => createStream()) => {
  getUserMedia = mock.fn(getStream);
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;
  globalThis.FileReader = class FakeFileReader {
    readAsDataURL(blob) {
      queueMicrotask(() => {
        this.result = `data:${blob.type};base64,${blob.size}`;
        this.onload?.();
      });
    }
  };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const waitFor = async (predicate) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('condition did not become true');
};

const createHandlers = () => {
  const segments = [];
  const transcripts = [];
  const states = [];
  const errors = [];
  return {
    segments,
    transcripts,
    states,
    errors,
    handlers: {
      onSegmentReady: (segment) => segments.push(segment),
      onTranscriptChange: (transcript) => transcripts.push(transcript),
      onStateChange: (state) => states.push(state),
      onError: (error) => errors.push(error),
    },
  };
};

const audioBuffer = () => ({
  numberOfChannels: 1,
  sampleRate: 16_000,
  length: 4,
  duration: 4 / 16_000,
  getChannelData: () => new Float32Array([0.1, -0.1, 0.2, -0.2]),
});

beforeEach(() => {
  streams = [];
  transcribers.length = 0;
  pendingTranscriberStarts.length = 0;
  FakeMediaRecorder.deferStops = false;
  FakeMediaRecorder.pendingStops = [];
});

test('cancellation during startup stops a Moonshine microphone stream that resolves later', async () => {
  let resolveStream;
  installBrowser(() => new Promise((resolve) => { resolveStream = resolve; }));
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  const startPromise = provider.start();
  await waitFor(() => typeof resolveStream === 'function');

  const cancelPromise = provider.cancel();
  const stream = createStream();
  const pendingCapture = streams.at(-1);
  resolveStream(stream);
  await Promise.allSettled([startPromise, cancelPromise]);

  assert.equal(pendingCapture.track.stop.mock.calls.length, 1);
  assert.equal(transcribers.length, 1);
  assert.equal(transcribers[0].isActive, false);
});

test('stop during startup stops a stream that resolves after startup was cancelled', async () => {
  let resolveStream;
  installBrowser(() => new Promise((resolve) => { resolveStream = resolve; }));
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  const startPromise = provider.start();
  await waitFor(() => typeof resolveStream === 'function');

  const stopPromise = provider.stop();
  const stream = createStream();
  const pendingCapture = streams.at(-1);
  resolveStream(stream);
  await Promise.allSettled([startPromise, stopPromise]);

  assert.equal(pendingCapture.track.stop.mock.calls.length, 1);
  assert.equal(result.states.at(-1), 'idle');
});

test('stale Moonshine startup cannot replace an immediately restarted session', async () => {
  const pendingStreams = [];
  installBrowser(() => new Promise((resolve) => pendingStreams.push(resolve)));
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  const oldStart = provider.start();
  await waitFor(() => pendingStreams.length === 1);

  await provider.cancel();
  const newStart = provider.start();
  await waitFor(() => pendingStreams.length === 2);

  const currentCapture = createStream();
  const staleCapture = createStream();
  pendingStreams[1](currentCapture);
  await newStart;
  pendingStreams[0](staleCapture);
  await oldStart;

  assert.equal(streams[0].track.stop.mock.calls.length, 0);
  assert.equal(streams[1].track.stop.mock.calls.length, 1);
  assert.equal(transcribers.length, 2);
  assert.equal(transcribers[1].isActive, true);
  await provider.cancel();
});

test('stale Moonshine instance startup cannot stop the restarted session', async () => {
  installBrowser();
  let resolveOldStart;
  pendingTranscriberStarts.push(new Promise((resolve) => { resolveOldStart = resolve; }));
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  const oldStart = provider.start();
  await waitFor(() => transcribers.length === 1);
  const oldCapture = streams[0];

  await provider.cancel();
  const newStart = provider.start();
  await newStart;
  const currentCapture = streams[1];
  assert.equal(transcribers[1].isActive, true);

  resolveOldStart();
  await oldStart;

  assert.equal(transcribers[1].isActive, true);
  assert.equal(currentCapture.track.stop.mock.calls.length, 0);
  assert.equal(oldCapture.track.stop.mock.calls.length > 0, true);
});

for (const method of ['cancel', 'destroy']) {
  test(`${method} suppresses a deferred Moonshine audio and transcript result`, async () => {
    installBrowser();
    const result = createHandlers();
    const provider = await createMoonshineVoiceProvider()(result.handlers);
    await provider.start();
    const instance = transcribers[0];
    instance.emitCommit('hello', audioBuffer());

    await provider[method]();
    await flush();

    assert.equal(result.segments.length, 0);
    assert.equal(result.transcripts.some((transcript) => transcript.final === 'hello'), false);
    assert.equal(result.errors.length, 0);
  });
}

test('manual stop owns the audio segment when a committed callback races it', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  await provider.start();
  const instance = transcribers[0];
  instance.emitSpeechStart();
  const stopPromise = provider.stop();
  instance.emitCommit('late transcript', audioBuffer());
  await stopPromise;
  await flush();

  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].metadata.source, 'moonshine-manual-stop');
  assert.equal(result.segments[0].transcript, undefined);
});

test('ordinary Moonshine speech delivers combined audio and transcript', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  await provider.start();
  const instance = transcribers[0];
  instance.emitSpeechStart();
  instance.emitSpeechEnd();
  instance.emitCommit('hello world', audioBuffer());
  await flush();

  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].attachment.kind, 'audio');
  assert.deepEqual(result.segments[0].transcript, { final: 'hello world' });
  assert.equal(result.transcripts.some((transcript) => transcript.final === 'hello world'), true);
});

test('a deferred prior segment cannot reset a newly started Moonshine segment', async () => {
  installBrowser();
  const pendingReads = [];
  globalThis.FileReader = class DeferredFileReader {
    readAsDataURL() {
      pendingReads.push(this);
    }
  };
  const resolveRead = () => {
    const reader = pendingReads.shift();
    assert.ok(reader);
    reader.result = 'data:audio/wav;base64,AAAA';
    reader.onload?.();
  };
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  await provider.start();
  const instance = transcribers[0];

  instance.emitSpeechStart();
  instance.emitSpeechEnd();
  instance.emitCommit('first', audioBuffer());
  await waitFor(() => pendingReads.length === 1);

  instance.emitSpeechStart();
  resolveRead();
  await flush();

  assert.equal(result.segments.length, 1);
  assert.equal(result.states.at(-1), 'listening');

  instance.emitSpeechEnd();
  instance.emitCommit('second', audioBuffer());
  await waitFor(() => pendingReads.length === 1);
  resolveRead();
  await flush();

  assert.equal(result.segments.length, 2);
  assert.deepEqual(result.segments[1].transcript, { final: 'second' });
  await provider.cancel();
});

test('Moonshine recording limit finishes the active segment', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers, { maxRecordingMs: 25 });
  await provider.start();
  const instance = transcribers[0];
  const originalSetTimeout = globalThis.setTimeout;
  const scheduled = [];
  globalThis.setTimeout = (callback) => {
    scheduled.push(callback);
    return 0;
  };
  try {
    instance.emitSpeechStart();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(scheduled.length, 1);
  scheduled[0]();
  await flush();

  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].metadata.source, 'moonshine-manual-stop');
});

test('overlapping recorder callbacks keep each recorder audio isolated', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createMoonshineVoiceProvider()(result.handlers);
  await provider.start();
  const instance = transcribers[0];
  FakeMediaRecorder.deferStops = true;

  instance.emitSpeechStart();
  instance.emitSpeechEnd();
  instance.emitSpeechStart();
  const firstRecorder = FakeMediaRecorder.pendingStops.shift();
  assert.ok(firstRecorder);

  firstRecorder.payload = 'old recorder payload';
  firstRecorder.finishStop();
  const stopPromise = provider.stop();
  const secondRecorder = FakeMediaRecorder.pendingStops.shift();
  assert.ok(secondRecorder);
  secondRecorder.payload = 'new recorder payload with more bytes';
  secondRecorder.finishStop();
  await stopPromise;
  await flush();

  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].attachment.size, new Blob([secondRecorder.payload]).size);
  await provider.cancel();
});
