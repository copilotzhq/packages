import test from "node:test";
import assert from "node:assert/strict";
import { withPendingAssistant } from "../src/lib/pendingAssistant.ts";

test("pending work uses the normal agent thinking activity and disappears on stream or settlement", () => {
  const user = {
    id: "u",
    role: "user" as const,
    content: "Hello",
    timestamp: 10,
  };
  const sender = { type: "agent" as const, id: "north", name: "North" };
  const waiting = withPendingAssistant([user], true, sender);
  assert.equal(waiting.length, 2);
  assert.equal(waiting[1].sender, sender);
  assert.deepEqual(waiting[1].activity?.items, [
    { id: "waiting", kind: "thinking", status: "active" },
  ]);
  const real = [...waiting.slice(0, 1), { ...waiting[1], id: "real" }];
  assert.equal(withPendingAssistant(real, true, sender), real);
  assert.deepEqual(withPendingAssistant([user], false, sender), [user]);
});
