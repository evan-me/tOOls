const test = require("node:test");
const assert = require("node:assert/strict");

function loadClipboardMetadataModule() {
  try {
    return require("../../src/main/lib/clipboard-metadata.js");
  } catch {
    return {};
  }
}

function requireClipboardMetadataExports() {
  const moduleExports = loadClipboardMetadataModule();
  assert.equal(
    typeof moduleExports.normalizeClipboardPatch,
    "function",
    "expected normalizeClipboardPatch to be implemented",
  );
  return moduleExports;
}

test("clipboard patch trims title and deduplicates tags", () => {
  const { normalizeClipboardPatch } = requireClipboardMetadataExports();

  const patch = normalizeClipboardPatch({
    title: "  Build release note  ",
    tags: [" docs ", "release", "docs", ""],
    isFavorite: true,
  });

  assert.deepEqual(patch, {
    title: "Build release note",
    tags: ["docs", "release"],
    isFavorite: true,
  });
});

test("clipboard patch rejects unsupported fields", () => {
  const { normalizeClipboardPatch } = requireClipboardMetadataExports();

  assert.throws(
    () => normalizeClipboardPatch({ title: "Snippet", priority: 1 }),
    /Unsupported clipboard patch field/,
  );
});

