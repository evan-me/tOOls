const VALID_CLIPBOARD_PATCH_FIELDS = new Set([
  "title",
  "tags",
  "isFavorite",
]);

function normalizeClipboardTitle(value) {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error("Clipboard title must be a string");
  }

  return value.trim();
}

function normalizeClipboardTags(tags) {
  if (tags === undefined) {
    return [];
  }
  if (!Array.isArray(tags)) {
    throw new Error("Clipboard tags must be an array");
  }

  const seenTags = new Set();
  const normalizedTags = [];

  for (const tag of tags) {
    if (typeof tag !== "string") {
      throw new Error("Clipboard tags must be strings");
    }

    const normalizedTag = tag.trim();
    if (!normalizedTag || seenTags.has(normalizedTag)) {
      continue;
    }

    seenTags.add(normalizedTag);
    normalizedTags.push(normalizedTag);
  }

  return normalizedTags;
}

function normalizeClipboardBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }

  return value;
}

function normalizeClipboardPatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Clipboard patch must be an object");
  }

  const normalizedPatch = {};

  for (const fieldName of Object.keys(patch)) {
    if (!VALID_CLIPBOARD_PATCH_FIELDS.has(fieldName)) {
      throw new Error(`Unsupported clipboard patch field: ${fieldName}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    normalizedPatch.title = normalizeClipboardTitle(patch.title);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
    normalizedPatch.tags = normalizeClipboardTags(patch.tags);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "isFavorite")) {
    normalizedPatch.isFavorite = normalizeClipboardBoolean(
      patch.isFavorite,
      "isFavorite",
    );
  }
  return normalizedPatch;
}

module.exports = {
  normalizeClipboardPatch,
};