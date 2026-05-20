const DEFAULT_CLIPBOARD_HISTORY_PAGE_SIZE = 50;
const MAX_CLIPBOARD_HISTORY_PAGE_SIZE = 100;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizePositiveInteger(value, fallback) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    return fallback;
  }
  return normalized;
}

function normalizeClipboardHistoryPageRequest(request = {}) {
  const normalizedRequest =
    request && typeof request === "object" && !Array.isArray(request) ? request : {};
  const offset = normalizePositiveInteger(normalizedRequest.offset, 0);
  const requestedLimit = normalizePositiveInteger(
    normalizedRequest.limit,
    DEFAULT_CLIPBOARD_HISTORY_PAGE_SIZE,
  );
  const limit = Math.min(
    Math.max(requestedLimit, 1),
    MAX_CLIPBOARD_HISTORY_PAGE_SIZE,
  );
  const searchQuery =
    typeof normalizedRequest.searchQuery === "string"
      ? normalizedRequest.searchQuery.trim()
      : "";
  const selectedDate =
    typeof normalizedRequest.selectedDate === "string" &&
    DATE_ONLY_PATTERN.test(normalizedRequest.selectedDate)
      ? normalizedRequest.selectedDate
      : null;

  return {
    offset,
    limit,
    searchQuery,
    selectedDate,
  };
}

function getClipboardHistoryDateRange(selectedDate) {
  if (!selectedDate) {
    return null;
  }

  const [year, month, day] = selectedDate.split("-").map((value) => Number(value));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const startAt = new Date(year, month - 1, day).getTime();
  const endAt = new Date(year, month - 1, day + 1).getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
    return null;
  }

  return {
    startAt,
    endAt,
  };
}

function buildClipboardHistoryPageResult({
  items,
  offset = 0,
  limit = DEFAULT_CLIPBOARD_HISTORY_PAGE_SIZE,
  totalCount = 0,
} = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedOffset = normalizePositiveInteger(offset, 0);
  const normalizedLimit = Math.max(normalizePositiveInteger(limit, 0), 1);
  const normalizedTotalCount = Math.max(normalizePositiveInteger(totalCount, 0), 0);
  const nextOffset = normalizedOffset + normalizedItems.length;

  return {
    items: normalizedItems,
    offset: normalizedOffset,
    nextOffset,
    hasMore: nextOffset < normalizedTotalCount || normalizedItems.length === normalizedLimit,
    totalCount: normalizedTotalCount,
  };
}

module.exports = {
  DEFAULT_CLIPBOARD_HISTORY_PAGE_SIZE,
  MAX_CLIPBOARD_HISTORY_PAGE_SIZE,
  normalizeClipboardHistoryPageRequest,
  getClipboardHistoryDateRange,
  buildClipboardHistoryPageResult,
};
