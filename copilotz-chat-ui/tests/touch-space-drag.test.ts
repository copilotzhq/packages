import assert from "node:assert/strict";
import test from "node:test";
import { TouchSpaceDrag, spaceDragScrollSpeed } from "../src/lib/touchSpaceDrag.ts";

test("handle tap stays unarmed; only its owning pointer activates or releases", () => {
  const drag = new TouchSpaceDrag();
  assert.equal(drag.start(1, "thread", "source", 10, 10), true);
  assert.equal(drag.start(2, "other", null, 0, 0), false);
  assert.equal(drag.update(2, 30, 30), false);
  assert.equal(drag.release(2, "target", ["target"]), null);
  assert.ok(drag.session);
  assert.equal(drag.update(1, 12, 12), false);
  assert.equal(drag.release(1, "target", ["target"]), null);
  assert.equal(drag.session, null);
});

test("a valid release consumes the gesture before an async callback; duplicate release cannot commit", async () => {
  const drag = new TouchSpaceDrag();
  drag.start(1, "thread", "source", 0, 0);
  assert.equal(drag.update(1, 6, 0), true);
  const result = drag.release(1, "target", ["target"]);
  assert.deepEqual(result, { threadId: "thread", spaceId: "target" });
  assert.equal(drag.session, null);
  assert.equal(drag.release(1, "target", ["target"]), null);
  await Promise.resolve();
  assert.equal(drag.release(1, "target", ["target"]), null);
});

test("cancel, outside, original and newly ineligible destinations never commit", () => {
  for (const target of [null, "source", "missing"]) {
    const drag = new TouchSpaceDrag();
    drag.start(7, "thread", "source", 0, 0);
    drag.update(7, 8, 8);
    assert.equal(drag.release(7, target, ["target", "source"]), null);
    assert.equal(drag.session, null);
  }
  const drag = new TouchSpaceDrag();
  drag.start(1, "thread", null, 0, 0);
  drag.update(1, 10, 10);
  drag.cancel();
  assert.equal(drag.release(1, "target", ["target"]), null);
  assert.equal(drag.start(2, "thread", null, 0, 0), true);
});

test("edge scrolling is bounded, bidirectional and confined to the destination viewport", () => {
  const rect = { left: 10, right: 210, top: 100, bottom: 500, height: 400 };
  assert.equal(spaceDragScrollSpeed(100, 100, rect), -480);
  assert.equal(spaceDragScrollSpeed(100, 500, rect), 480);
  assert.equal(spaceDragScrollSpeed(100, 300, rect), 0);
  assert.equal(spaceDragScrollSpeed(0, 490, rect), 0);
  assert.equal(spaceDragScrollSpeed(100, 501, rect), 0);
  assert.equal(spaceDragScrollSpeed(100, 99, rect), 0);
  assert.ok(spaceDragScrollSpeed(100, 490, rect) > 0);
  assert.ok(spaceDragScrollSpeed(100, 110, rect) < 0);
  assert.equal(spaceDragScrollSpeed(50, 100, { ...rect, height: 0 }), 0);
});
