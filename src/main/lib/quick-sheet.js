const VALID_QUICK_SHEET_ACTION_TYPES = new Set([
  "open-main-window",
  "create-todo",
  "copy-clipboard-item",
]);

function normalizeTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isReusableClipboardRow(row) {
  return Boolean(Number(row?.is_favorite));
}

function compareQuickSheetRows(left, right) {
  const lastUsedDiff =
    normalizeTimestamp(right?.last_used_at) - normalizeTimestamp(left?.last_used_at);
  if (lastUsedDiff !== 0) {
    return lastUsedDiff;
  }

  const updatedDiff =
    normalizeTimestamp(right?.updated_at || right?.created_at) -
    normalizeTimestamp(left?.updated_at || left?.created_at);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  return normalizeTimestamp(right?.created_at) - normalizeTimestamp(left?.created_at);
}

function pickQuickSheetReusableItems(rows, limit = 5) {
  if (!Array.isArray(rows)) {
    return [];
  }

  const normalizedLimit = Math.max(Number(limit) || 0, 0);
  return [...rows]
    .filter((row) => isReusableClipboardRow(row))
    .sort(compareQuickSheetRows)
    .slice(0, normalizedLimit);
}

function normalizeQuickSheetAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("Quick sheet action must be an object");
  }

  const type = String(action.type || "").trim();
  if (!VALID_QUICK_SHEET_ACTION_TYPES.has(type)) {
    throw new Error("Invalid quick sheet action type");
  }

  if (type === "open-main-window") {
    return { type };
  }

  if (type === "create-todo") {
    const title = String(action.title || "").trim();
    if (!title || title.length > 500) {
      throw new Error("Invalid quick sheet todo title");
    }

    return {
      type,
      title,
      listId: action.listId ?? null,
    };
  }

  if (
    typeof action.itemId !== "number" ||
    Number.isNaN(action.itemId) ||
    action.itemId <= 0
  ) {
    throw new Error("Invalid quick sheet itemId");
  }

  return {
    type,
    itemId: action.itemId,
  };
}

module.exports = {
  pickQuickSheetReusableItems,
  normalizeQuickSheetAction,
};