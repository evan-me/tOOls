const test = require("node:test");
const assert = require("node:assert/strict");

function loadClipboardModule() {
  try {
    return require("../../src/main/lib/clipboard-retention.js");
  } catch {
    return {};
  }
}

function requireClipboardExports() {
  const moduleExports = loadClipboardModule();
  assert.equal(
    typeof moduleExports.pickClipboardIdsToDelete,
    "function",
    "expected pickClipboardIdsToDelete to be implemented",
  );
  return moduleExports;
}

function createRow(id, overrides = {}) {
  return {
    id,
    created_at: 10_000 - id,
    is_favorite: 0,
    ...overrides,
  };
}

test("retention deletes only plain history beyond limit", () => {
  const { pickClipboardIdsToDelete } = requireClipboardExports();
  const rows = [];
  for (let id = 1; id <= 205; id += 1) {
    rows.push(createRow(id));
  }

  const idsToDelete = pickClipboardIdsToDelete(rows, 200);

  assert.deepEqual(idsToDelete, [201, 202, 203, 204, 205]);
});

test("retention keeps favorites even when they are older than the limit", () => {
  const { pickClipboardIdsToDelete } = requireClipboardExports();
  const rows = [];
  for (let id = 1; id <= 205; id += 1) {
    rows.push(
      createRow(id, {
        is_favorite: id === 202 ? 1 : 0,
      }),
    );
  }

  const idsToDelete = pickClipboardIdsToDelete(rows, 200);

  assert.deepEqual(idsToDelete, [201, 203, 204, 205]);
});

test("retention keeps rows marked as favorite", () => {
  const { pickClipboardIdsToDelete } = requireClipboardExports();
  const rows = [];
  for (let id = 1; id <= 203; id += 1) {
    rows.push(
      createRow(id, {
        is_favorite: id === 203 ? 1 : 0,
      }),
    );
  }

  const idsToDelete = pickClipboardIdsToDelete(rows, 200);

  assert.deepEqual(idsToDelete, [201, 202]);
});

test("retention leaves rows untouched when plain history count is within the limit", () => {
  const { pickClipboardIdsToDelete } = requireClipboardExports();
  const rows = [];
  for (let id = 1; id <= 120; id += 1) {
    rows.push(createRow(id));
  }

  const idsToDelete = pickClipboardIdsToDelete(rows, 200);

  assert.deepEqual(idsToDelete, []);
});