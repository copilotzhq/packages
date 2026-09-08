import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UsageSummary } from "../dist/index.js";
import { latestRequest } from "../src/data/latest.ts";
import {
  emptyFields,
  makeFilters,
  selectRange,
  validateInterval,
} from "../src/data/selection.ts";

test("superseded reads cannot apply even if the data source ignores cancellation", () => {
  const requests = latestRequest();
  const first = requests.start();
  const second = requests.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  requests.cancel();
  assert.equal(second.isCurrent(), false);
});
test("ranges are deterministic and custom inputs are interpreted in UTC", () => {
  const now = Date.parse("2026-09-08T12:00:00Z");
  assert.deepEqual(selectRange("7d", "", "", now), {
    from: "2026-09-01T12:00:00.000Z",
    to: "2026-09-08T12:00:00.000Z",
  });
  assert.deepEqual(
    selectRange("custom", "2026-09-01T09:00", "2026-09-02T09:00", now),
    { from: "2026-09-01T09:00:00.000Z", to: "2026-09-02T09:00:00.000Z" },
  );
  assert.throws(() => selectRange("custom", "bad", "also-bad", now), /Choose/);
  assert.throws(
    () => selectRange("custom", "2026-09-02", "2026-09-01", now),
    /after/,
  );
});
test("type changes do not leak provider filters into tools or tool filters into LLM", () => {
  const range = { from: "2026-09-01T00:00:00Z", to: "2026-09-02T00:00:00Z" };
  const fields = {
    ...emptyFields,
    provider: "openai",
    model: "model",
    resource: "browser",
    agentId: "north",
  };
  assert.deepEqual(makeFilters("tool", range, fields), {
    kind: "tool",
    ...range,
    resource: "browser",
    agentId: "north",
  });
  assert.deepEqual(makeFilters("llm", range, fields), {
    kind: "llm",
    ...range,
    provider: "openai",
    model: "model",
    agentId: "north",
  });
  assert.throws(
    () =>
      validateInterval(
        { kind: "llm", from: "2026-01-01", to: "2026-04-01" },
        "hour",
      ),
    /31 days/,
  );
});
const metrics = {
  attempts: 2,
  completed: 1,
  failed: 0,
  cancelled: 0,
  deferred: 1,
  inputTokens: 100,
  outputTokens: 20,
  reasoningTokens: 10,
  cachedInputTokens: 0,
  cacheCreationInputTokens: null,
  totalTokens: 120,
  durationMs: null,
  averageDurationMs: null,
  durationReported: 0,
  inputReported: 2,
  cacheReported: 1,
  cacheMeasuredInputTokens: 100,
  cacheMeasuredReadTokens: 0,
  cacheReuse: 0,
  cacheCoverage: .5,
};
test("LLM summary distinguishes zero reuse from unreported cache writes", () => {
  const html = renderToStaticMarkup(
    React.createElement(UsageSummary, { metrics, kind: "llm" }),
  );
  assert.match(html, /Cache reuse/);
  assert.match(html, /0%/);
  assert.match(html, /50%/);
  assert.match(html, /Not reported cache-write tokens/);
  assert.doesNotMatch(html, /Tool executions/);
});
test("tool summary exposes deferred outcomes and honest timing coverage", () => {
  const html = renderToStaticMarkup(
    React.createElement(UsageSummary, { metrics, kind: "tool" }),
  );
  assert.match(html, /Deferred/);
  assert.match(html, /Not reported/);
  assert.match(html, /0 of 2 executions have timing/);
  assert.doesNotMatch(html, /Input tokens/);
});
