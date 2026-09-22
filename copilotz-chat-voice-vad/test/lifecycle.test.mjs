import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const vadInstances = [];
const pendingVadCreates = [];
const pendingVadStarts = [];

class FakeMicVAD {
  static async new(options) {
    if (pendingVadCreates.length > 0) {
      const instance = new FakeMicVAD(options);
      vadInstances.push(instance);
      return pendingVadCreates.shift().promise.then(async () => {
        if (options.startOnLoad) await instance.start();
        return instance;
      });
    }

    const instance = new FakeMicVAD(options);
    vadInstances.push(instance);
    if (options.startOnLoad) await instance.start();
    return instance;
  }

  constructor(options) {
    this.options = options;
    this.listening = false;
    this.speechActive = false;
    this.destroyed = false;
    this.destroyCalls = 0;
    this.hasStarted = false;
  }

  async start() {
    if (this.hasStarted && this.listening) return;
    this.listening = true;
    await (this.hasStarted ? this.options.resumeStream() : this.options.getStream());
    const pendingStart = pendingVadStarts.shift();
    if (pendingStart) await pendingStart;
    this.hasStarted = true;
  }

  async pause() {
    this.listening = false;
    if (this.options.submitUserSpeechOnPause && this.speechActive) {
      this.emitSpeechEnd();
    }
  }

  async destroy() {
    this.destroyCalls += 1;
    if (!this.hasStarted) {
      throw new Error('destroyed before startup finished');
    }
    this.destroyed = true;
    this.listening = false;
  }

  emitSpeechStart() {
    this.speechActive = true;
    this.options.onSpeechStart();
  }

  emitSpeechEnd(audio = new Float32Array([0.1, 0.2, 0.3])) {
    this.speechActive = false;
    this.options.onSpeechEnd(audio);
  }

  emitVADMisfire() {
    this.options.onVADMisfire();
  }
}

mock.module('@ricky0123/vad-web', {
  namedExports: {
    MicVAD: FakeMicVAD,
    utils: {
      encodeWAV: () => new ArrayBuffer(8),
    },
  },
});

mock.module('onnxruntime-web/wasm', {
  namedExports: {
    env: { versions: { web: '1.24.3' } },
  },
});

const { createVadVoiceProvider } = await import('../src/index.ts');

let streams;
let getUserMedia;

const createStream = () => {
  const track = { stop: mock.fn() };
  const stream = { getTracks: () => [track] };
  streams.push({ stream, track });
  return stream;
};

const installBrowser = (getStream = async () => createStream()) => {
  getUserMedia = mock.fn(getStream);
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  });
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
  const states = [];
  const errors = [];
  return {
    segments,
    states,
    errors,
    handlers: {
      onSegmentReady: (segment) => segments.push(segment),
      onStateChange: (state) => states.push(state),
      onError: (error) => errors.push(error),
    },
  };
};

beforeEach(() => {
  streams = [];
  vadInstances.length = 0;
  pendingVadCreates.length = 0;
  pendingVadStarts.length = 0;
});

test('cancellation during startup stops a microphone stream that resolves later', async () => {
  let resolveStream;
  installBrowser(() => new Promise((resolve) => { resolveStream = resolve; }));
  const { handlers } = createHandlers();
  const provider = await createVadVoiceProvider()(handlers);
  const startPromise = provider.start();
  await waitFor(() => typeof resolveStream === 'function');

  const cancelPromise = provider.cancel();
  const stream = createStream();
  const pendingCapture = streams.at(-1);
  resolveStream(stream);
  await Promise.allSettled([startPromise, cancelPromise]);

  assert.equal(pendingCapture.track.stop.mock.calls.length, 1);
  assert.equal(vadInstances.length, 0);
});

test('stop during startup releases a stream that resolves later', async () => {
  let resolveStream;
  installBrowser(() => new Promise((resolve) => { resolveStream = resolve; }));
  const { handlers } = createHandlers();
  const provider = await createVadVoiceProvider()(handlers);
  const startPromise = provider.start();
  await waitFor(() => typeof resolveStream === 'function');

  const stopPromise = provider.stop();
  const stream = createStream();
  const pendingCapture = streams.at(-1);
  resolveStream(stream);
  await Promise.allSettled([startPromise, stopPromise]);

  assert.equal(pendingCapture.track.stop.mock.calls.length, 1);
});

test('a cancelled deferred VAD encoding never delivers a segment', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  await provider.start();
  const instance = vadInstances[0];
  instance.emitSpeechStart();
  instance.emitSpeechEnd();

  await provider.cancel();
  await flush();

  assert.equal(result.segments.length, 0);
  assert.equal(result.errors.length, 0);
});

test('destroyed deferred VAD encoding never delivers a segment', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  await provider.start();
  const instance = vadInstances[0];
  instance.emitSpeechStart();
  instance.emitSpeechEnd();

  await provider.destroy();
  await flush();

  assert.equal(result.segments.length, 0);
  assert.equal(result.errors.length, 0);
});

test('empty VAD callbacks and misfires do not emit a segment', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  await provider.start();
  const instance = vadInstances[0];

  instance.emitSpeechEnd(new Float32Array());
  instance.emitVADMisfire();
  await flush();

  assert.equal(result.segments.length, 0);
  assert.equal(result.errors.length, 0);
  assert.equal(result.states.at(-1), 'waiting_for_speech');
  await provider.cancel();
});

test('VAD model startup failure releases the acquired microphone', async () => {
  installBrowser();
  let rejectCreate;
  pendingVadCreates.push({
    promise: new Promise((_, reject) => { rejectCreate = reject; }),
  });
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  const startPromise = provider.start();
  await waitFor(() => vadInstances.length === 1 && streams.length === 1);
  const capture = streams[0];

  rejectCreate(new Error('VAD model failed to load'));

  await assert.rejects(startPromise, /VAD model failed to load/);
  assert.equal(capture.track.stop.mock.calls.length, 1);
  assert.equal(result.segments.length, 0);
  assert.equal(result.errors.length, 0);
});

test('duplicate VAD speech-end callbacks deliver one segment', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  await provider.start();
  const instance = vadInstances[0];
  instance.emitSpeechStart();
  instance.emitSpeechEnd();
  instance.emitSpeechEnd();
  await flush();

  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].metadata.source, 'vad');
});

test('VAD recording limit finishes the active segment', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers, { maxRecordingMs: 25 });
  await provider.start();
  const instance = vadInstances[0];
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
  assert.equal(result.segments[0].metadata.source, 'vad');
});

test('VAD reuses its instance with a fresh stream after a normal stop', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  await provider.start();
  const instance = vadInstances[0];
  await provider.stop();
  await provider.start();

  assert.equal(getUserMedia.mock.calls.length, 2);
  assert.equal(vadInstances.length, 1);
  assert.equal(instance.destroyed, false);
});

test('cancelling a resumed VAD start disposes after its late stream settles', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  await provider.start();
  const instance = vadInstances[0];
  await provider.stop();

  let resolveStream;
  getUserMedia = mock.fn(() => new Promise((resolve) => { resolveStream = resolve; }));
  globalThis.navigator.mediaDevices.getUserMedia = getUserMedia;
  const restart = provider.start();
  await waitFor(() => typeof resolveStream === 'function');

  const lateStream = createStream();
  const lateCapture = streams.at(-1);
  const cancel = provider.cancel();
  resolveStream(lateStream);
  await Promise.allSettled([restart, cancel]);

  assert.equal(lateCapture.track.stop.mock.calls.length, 1);
  assert.equal(instance.destroyed, true);
  assert.equal(instance.destroyCalls, 1);
});

test('cancelling a successfully resumed VAD start destroys once after startup settles', async () => {
  installBrowser();
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);
  await provider.start();
  const instance = vadInstances[0];
  await provider.stop();

  let resolveStart;
  pendingVadStarts.push(new Promise((resolve) => { resolveStart = resolve; }));
  const restart = provider.start();
  await waitFor(() => streams.length === 2 && typeof resolveStart === 'function');

  const cancel = provider.cancel();
  resolveStart();
  await Promise.allSettled([restart, cancel]);

  assert.equal(instance.destroyed, true);
  assert.equal(instance.destroyCalls, 1);
  assert.equal(result.states.at(-1), 'idle');
});

test('stale VAD initialization cannot replace an immediately restarted session', async () => {
  installBrowser();
  const createGate = () => {
    let resolve;
    const promise = new Promise((next) => { resolve = next; });
    return { promise, resolve };
  };
  const oldCreate = createGate();
  const newCreate = createGate();
  pendingVadCreates.push(oldCreate, newCreate);
  const result = createHandlers();
  const provider = await createVadVoiceProvider()(result.handlers);

  const oldStart = provider.start();
  await waitFor(() => vadInstances.length === 1);
  await provider.cancel();
  const newStart = provider.start();
  await waitFor(() => vadInstances.length === 2);

  const current = vadInstances[1];
  newCreate.resolve();
  await newStart;
  const old = vadInstances[0];
  oldCreate.resolve();
  await oldStart;

  assert.equal(old.destroyed, true);
  assert.equal(old.destroyCalls, 1);
  assert.equal(current.destroyed, false);
  current.emitSpeechStart();
  current.emitSpeechEnd();
  await flush();
  assert.equal(result.segments.length, 1);
  await provider.cancel();
});
