const test = require("node:test");
const assert = require("node:assert/strict");

function loadMarkdownMetadataModule() {
  try {
    return require("../../src/main/lib/markdown-metadata.js");
  } catch {
    return {};
  }
}

function requireMarkdownMetadataExports() {
  const moduleExports = loadMarkdownMetadataModule();
  assert.equal(
    typeof moduleExports.normalizeMarkdownDocumentInput,
    "function",
    "expected normalizeMarkdownDocumentInput to be implemented",
  );
  return moduleExports;
}

test("markdown input trims title and deduplicates tags", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  const payload = normalizeMarkdownDocumentInput({
    title: "  Weekly Note  ",
    content: "# hello",
    tags: [" weekly ", "docs", "weekly", ""],
  });

  assert.deepEqual(payload, {
    id: null,
    title: "Weekly Note",
    content: "# hello",
    tags: ["weekly", "docs"],
  });
});

test("markdown input allows empty title and empty content", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  const payload = normalizeMarkdownDocumentInput({
    title: "   ",
    content: "",
    tags: [],
  });

  assert.deepEqual(payload, {
    id: null,
    title: "",
    content: "",
    tags: [],
  });
});

test("markdown input rejects non-string content", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  assert.throws(
    () =>
      normalizeMarkdownDocumentInput({
        title: "Weekly Note",
        content: 42,
        tags: [],
      }),
    /content must be a string/i,
  );
});

test("markdown input rejects non-array tags", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  assert.throws(
    () =>
      normalizeMarkdownDocumentInput({
        title: "Weekly Note",
        content: "# hello",
        tags: "docs",
      }),
    /tags must be an array/i,
  );
});

test("markdown input rejects unsupported fields", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  assert.throws(
    () =>
      normalizeMarkdownDocumentInput({
        title: "Weekly Note",
        content: "# hello",
        tags: [],
        createdAt: Date.now(),
      }),
    /unsupported markdown field/i,
  );
});

test("markdown input rejects oversized content", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  assert.throws(
    () =>
      normalizeMarkdownDocumentInput({
        title: "Weekly Note",
        content: "a".repeat(1_000_001),
        tags: [],
      }),
    /content exceeds the maximum length/i,
  );
});

test("markdown input rejects too many tags", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  assert.throws(
    () =>
      normalizeMarkdownDocumentInput({
        title: "Weekly Note",
        content: "# hello",
        tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
      }),
    /tags exceed the maximum count/i,
  );
});

test("markdown input rejects oversized tags", () => {
  const { normalizeMarkdownDocumentInput } = requireMarkdownMetadataExports();

  assert.throws(
    () =>
      normalizeMarkdownDocumentInput({
        title: "Weekly Note",
        content: "# hello",
        tags: ["a".repeat(51)],
      }),
    /tag exceeds the maximum length/i,
  );
});