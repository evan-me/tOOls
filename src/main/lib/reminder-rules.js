const REMINDER_PRESET_DAY_OFFSETS = {
  none: [],
  "same-day-9am": [0],
  "day-before-9am": [-1],
  "day-before-and-same-day-9am": [-1, 0],
};

const REMINDER_FIRE_HOUR = 9;
const DEFAULT_REMINDER_MAX_CATCH_UP_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getTriggerTimestamp(dueAt, dayOffset) {
  const dueDate = new Date(dueAt);
  return new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate() + dayOffset,
    REMINDER_FIRE_HOUR,
    0,
    0,
    0,
  ).getTime();
}

function getReminderTriggersForDueDate(dueAt, preset) {
  const normalizedDueAt = normalizeTimestamp(dueAt);
  if (normalizedDueAt === null) {
    return [];
  }

  const dayOffsets = REMINDER_PRESET_DAY_OFFSETS[preset] || [];
  return dayOffsets
    .map((dayOffset) => getTriggerTimestamp(normalizedDueAt, dayOffset))
    .filter((triggerAt) => Number.isFinite(triggerAt))
    .sort((left, right) => left - right);
}

function getLatestEligibleReminderTrigger(dueAt, preset, now, options = {}) {
  const normalizedDueAt = normalizeTimestamp(dueAt);
  const normalizedNow = normalizeTimestamp(now);
  if (normalizedDueAt === null || normalizedNow === null) {
    return null;
  }

  const requestedCatchUpAge = normalizeTimestamp(options.maxCatchUpAgeMs);
  const maxCatchUpAgeMs =
    requestedCatchUpAge === null
      ? DEFAULT_REMINDER_MAX_CATCH_UP_AGE_MS
      : requestedCatchUpAge;

  if (normalizedDueAt < normalizedNow - maxCatchUpAgeMs) {
    return null;
  }

  const eligibleTriggers = getReminderTriggersForDueDate(
    normalizedDueAt,
    preset,
  ).filter((triggerAt) => triggerAt <= normalizedNow);
  if (eligibleTriggers.length === 0) {
    return null;
  }

  return eligibleTriggers[eligibleTriggers.length - 1];
}

function getReminderFireKey(dueAt, preset, triggerAt) {
  const normalizedDueAt = normalizeTimestamp(dueAt) ?? "invalid-due-at";
  const normalizedTriggerAt =
    normalizeTimestamp(triggerAt) ?? "invalid-trigger-at";
  return [normalizedDueAt, preset || "none", normalizedTriggerAt].join("::");
}

module.exports = {
  getReminderTriggersForDueDate,
  getLatestEligibleReminderTrigger,
  getReminderFireKey,
};