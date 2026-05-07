const test = require("node:test");
const assert = require("node:assert/strict");

function loadQuickSheetModule() {
  try {
    return require("../../src/main/lib/quick-sheet.js");
  } catch {
    return {};
  }
}

function requireQuickSheetExports() {
  const moduleExports = loadQuickSheetModule();
  assert.equal(
    typeof moduleExports.pickQuickSheetReusableItems,
    "function",
    "expected pickQuickSheetReusableItems to be implemented",
  );
  assert.equal(
    typeof moduleExports.normalizeQuickSheetAction,
    "function",
    "expected normalizeQuickSheetAction to be implemented",
  );
  return moduleExports;
}

function createReusableRow(id, overrides = {}) {
  return {
    id,
    title: `Snippet ${id}`,
    content: `Content ${id}`,
    is_favorite: 1,
    created_at: 1_000 + id,
    updated_at: 1_000 + id,
    last_used_at: 0,
    ...overrides,
  };
}

test("quick sheet picks reusable items by last used recency before updated time", () => {
  const { pickQuickSheetReusableItems } = requireQuickSheetExports();
  const rows = [
    createReusableRow(1, { last_used_at: 200 }),
    createReusableRow(2, { last_used_at: 500 }),
    createReusableRow(3, { last_used_at: 500, updated_at: 1_900 }),
    createReusableRow(4, { is_favorite: 0, last_used_at: 999 }),
    createReusableRow(5, { is_favorite: 1, last_used_at: 150 }),
  ];

  const pickedRows = pickQuickSheetReusableItems(rows, 3);

  assert.deepEqual(
    pickedRows.map((row) => row.id),
    [3, 2, 1],
  );
});

test("quick sheet normalizes create-todo actions", () => {
  const { normalizeQuickSheetAction } = requireQuickSheetExports();

  const action = normalizeQuickSheetAction({
    type: "create-todo",
    title: "  Ship Quick Sheet  ",
    listId: null,
  });

  assert.deepEqual(action, {
    type: "create-todo",
    title: "Ship Quick Sheet",
    listId: null,
  });
});

test("quick sheet rejects unsupported action types", () => {
  const { normalizeQuickSheetAction } = requireQuickSheetExports();

  assert.throws(
    () => normalizeQuickSheetAction({ type: "paste-back" }),
    /Invalid quick sheet action type/,
  );
});

test("quick sheet copy actions require a numeric item id", () => {
  const { normalizeQuickSheetAction } = requireQuickSheetExports();

  assert.throws(
    () => normalizeQuickSheetAction({ type: "copy-clipboard-item", itemId: "12" }),
    /Invalid quick sheet itemId/,
  );

  assert.throws(
    () => normalizeQuickSheetAction({ type: "copy-clipboard-item", itemId: 0 }),
    /Invalid quick sheet itemId/,
  );
});