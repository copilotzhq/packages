import test from "node:test";
import assert from "node:assert/strict";
import { groupThreadsBySpace } from "../src/lib/spaceGrouping.ts";

const thread = (id: string, spaceId?: string | null) => ({
  id,
  title: id,
  createdAt: 0,
  updatedAt: 0,
  messageCount: 0,
  spaceId,
});

test("Space grouping puts each conversation in one bucket and retains spaceless threads", () => {
  const groups = groupThreadsBySpace(
    [thread("a", "research"), thread("b"), thread("c", "missing")],
    [
      { id: "research", name: "Research" },
      { id: "empty", name: "Empty" },
    ],
  );

  assert.deepEqual(
    groups.map((group) => [group.key, group.threads.map((value) => value.id)]),
      [
      ["space:research", ["a"]],
      ["space:empty", []],
      ["space:unavailable:missing", ["c"]],
      ["space:none", ["b"]],
    ],
  );
  assert.equal(
    groups.flatMap((group) => group.threads).filter((value) => value.id === "a")
      .length,
    1,
  );
});

test("archived attachment stays visible and is labeled as archived", () => {
  const groups = groupThreadsBySpace(
    [thread("a", "archived")],
    [{ id: "archived", name: "Old", status: "archived" }],
  );
  assert.deepEqual(groups.map((group) => [group.key, group.label]), [
    ["space:archived:archived", "Old (Archived)"],
  ]);
});
