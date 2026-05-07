function normalizeRowTimestamp(row) {
  const timestamp = Number(row?.created_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeRowId(row) {
  const id = Number(row?.id);
  return Number.isFinite(id) ? id : 0;
}

function isReusableClipboardRow(row) {
  return Boolean(Number(row?.is_favorite));
}

function compareRowsByNewest(left, right) {
  const timestampDiff = normalizeRowTimestamp(right) - normalizeRowTimestamp(left);
  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return normalizeRowId(left) - normalizeRowId(right);
}

function pickClipboardIdsToDelete(rows, limit) {
  if (!Array.isArray(rows)) {
    return [];
  }

  const normalizedLimit = Math.max(Number(limit) || 0, 0);
  const sortedRows = [...rows].sort(compareRowsByNewest);
  const idsToDelete = [];
  let keptPlainHistoryCount = 0;

  for (const row of sortedRows) {
    if (isReusableClipboardRow(row)) {
      continue;
    }

    if (keptPlainHistoryCount < normalizedLimit) {
      keptPlainHistoryCount += 1;
      continue;
    }

    idsToDelete.push(row.id);
  }

  return idsToDelete;
}

module.exports = {
  pickClipboardIdsToDelete,
};