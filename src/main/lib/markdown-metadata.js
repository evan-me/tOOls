const VALID_MARKDOWN_FIELDS = new Set(["id", "title", "content", "tags"]);
const MAX_MARKDOWN_CONTENT_LENGTH = 1_000_000;
const MAX_MARKDOWN_TAG_COUNT = 20;
const MAX_MARKDOWN_TAG_LENGTH = 50;

function normalizeMarkdownId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Markdown document id must be a positive integer");
  }

  return id;
}

function normalizeMarkdownTitle(value) {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error("Markdown title must be a string");
  }

  return value.trim();
}

function normalizeMarkdownContent(value) {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error("Markdown content must be a string");
  }
  if (value.length > MAX_MARKDOWN_CONTENT_LENGTH) {
    throw new Error("Markdown content exceeds the maximum length");
  }

  return value;
}

function normalizeMarkdownTags(value) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Markdown tags must be an array");
  }
  if (value.length > MAX_MARKDOWN_TAG_COUNT) {
    throw new Error("Markdown tags exceed the maximum count");
  }

  const seenTags = new Set();
  const normalizedTags = [];

  for (const tag of value) {
    if (typeof tag !== "string") {
      throw new Error("Markdown tags must be strings");
    }

    const normalizedTag = tag.trim();
    if (normalizedTag.length > MAX_MARKDOWN_TAG_LENGTH) {
      throw new Error("Markdown tag exceeds the maximum length");
    }
    if (!normalizedTag || seenTags.has(normalizedTag)) {
      continue;
    }

    seenTags.add(normalizedTag);
    normalizedTags.push(normalizedTag);
  }

  return normalizedTags;
}

function normalizeMarkdownDocumentInput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Markdown payload must be an object");
  }

  for (const fieldName of Object.keys(payload)) {
    if (!VALID_MARKDOWN_FIELDS.has(fieldName)) {
      throw new Error(`Unsupported markdown field: ${fieldName}`);
    }
  }

  return {
    id: normalizeMarkdownId(payload.id),
    title: normalizeMarkdownTitle(payload.title),
    content: normalizeMarkdownContent(payload.content),
    tags: normalizeMarkdownTags(payload.tags),
  };
}

module.exports = {
  normalizeMarkdownDocumentInput,
};