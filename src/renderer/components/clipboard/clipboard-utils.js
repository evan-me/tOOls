export const PREVIEW_MAX_LENGTH = 120;

export function buildClipboardSignature(historyItems) {
  return JSON.stringify(
    historyItems.map((item) => [
      item.id,
      item.created_at,
      item.updated_at ?? 0,
      item.last_used_at ?? 0,
      item.is_favorite ?? 0,
      item.title ?? "",
      item.tags_json ?? "[]",
      item.content ?? "",
    ]),
  );
}

export function buildCalendarMatrix(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const rows = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }

  return rows;
}

export function tsToDateStr(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseClipboardTags(tagsJson) {
  if (typeof tagsJson !== "string" || tagsJson.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((tag) => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function tagsToInputValue(tags) {
  return tags.join(", ");
}

export function parseTagInput(rawValue) {
  const seenTags = new Set();

  return rawValue
    .split(/[\n,，]/)
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag || seenTags.has(tag)) {
        return false;
      }

      seenTags.add(tag);
      return true;
    });
}

export function isReusableItem(item) {
  return Boolean(Number(item?.is_favorite));
}

export function buildClipboardSearchText(item) {
  return [item?.title || "", item?.content || "", ...parseClipboardTags(item?.tags_json)]
    .join(" ")
    .toLowerCase();
}

export function truncateText(text, maxLen) {
  if (text.length <= maxLen) {
    return text;
  }

  return `${text.slice(0, maxLen)}…`;
}

export function getClipboardDisplayTitle(item) {
  const explicitTitle = (item?.title || "").trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const fallbackContent = (item?.content || "").replace(/\s+/g, " ").trim();
  if (!fallbackContent) {
    return "空内容";
  }

  return truncateText(fallbackContent, 38);
}

export function sortReusableItems(left, right) {
  const lastUsedDiff = Number(right.last_used_at || 0) - Number(left.last_used_at || 0);
  if (lastUsedDiff !== 0) {
    return lastUsedDiff;
  }

  const updatedDiff =
    Number(right.updated_at || right.created_at || 0) -
    Number(left.updated_at || left.created_at || 0);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  return Number(right.created_at || 0) - Number(left.created_at || 0);
}

export function formatClipboardTime(ts) {
  const date = new Date(ts);
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function groupClipboardItemsByDate(historyItems) {
  const groups = {};

  historyItems.forEach((item) => {
    const date = tsToDateStr(item.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date].push(item);
  });

  return Object.keys(groups)
    .sort((left, right) => right.localeCompare(left))
    .map((date) => ({ date, items: groups[date] }));
}