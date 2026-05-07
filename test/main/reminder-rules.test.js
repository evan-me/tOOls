const test = require("node:test");
const assert = require("node:assert/strict");

function loadReminderModule() {
  try {
    return require("../../src/main/lib/reminder-rules.js");
  } catch {
    return {};
  }
}

function requireReminderExports() {
  const moduleExports = loadReminderModule();
  assert.equal(
    typeof moduleExports.getReminderTriggersForDueDate,
    "function",
    "expected getReminderTriggersForDueDate to be implemented",
  );
  assert.equal(
    typeof moduleExports.getReminderFireKey,
    "function",
    "expected getReminderFireKey to be implemented",
  );
  assert.equal(
    typeof moduleExports.getLatestEligibleReminderTrigger,
    "function",
    "expected getLatestEligibleReminderTrigger to be implemented",
  );
  return moduleExports;
}

function getLocalParts(timestamp) {
  const date = new Date(timestamp);
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

test("same-day preset fires at local 09:00 on due date", () => {
  const { getReminderTriggersForDueDate } = requireReminderExports();
  const dueAt = new Date(2026, 3, 30, 23, 59, 59, 999).getTime();

  const triggers = getReminderTriggersForDueDate(dueAt, "same-day-9am");

  assert.equal(triggers.length, 1);
  assert.deepEqual(getLocalParts(triggers[0]), {
    year: 2026,
    month: 3,
    day: 30,
    hour: 9,
    minute: 0,
  });
});

test("day-before preset fires at local 09:00 on the previous day", () => {
  const { getReminderTriggersForDueDate } = requireReminderExports();
  const dueAt = new Date(2026, 3, 30, 23, 59, 59, 999).getTime();

  const triggers = getReminderTriggersForDueDate(dueAt, "day-before-9am");

  assert.equal(triggers.length, 1);
  assert.deepEqual(getLocalParts(triggers[0]), {
    year: 2026,
    month: 3,
    day: 29,
    hour: 9,
    minute: 0,
  });
});

test("combined preset returns previous-day and same-day reminders in ascending order", () => {
  const { getReminderTriggersForDueDate } = requireReminderExports();
  const dueAt = new Date(2026, 3, 30, 23, 59, 59, 999).getTime();

  const triggers = getReminderTriggersForDueDate(dueAt, "day-before-and-same-day-9am");

  assert.equal(triggers.length, 2);
  assert.ok(triggers[0] < triggers[1]);
  assert.deepEqual(getLocalParts(triggers[0]), {
    year: 2026,
    month: 3,
    day: 29,
    hour: 9,
    minute: 0,
  });
  assert.deepEqual(getLocalParts(triggers[1]), {
    year: 2026,
    month: 3,
    day: 30,
    hour: 9,
    minute: 0,
  });
});

test("none preset returns no reminder triggers", () => {
  const { getReminderTriggersForDueDate } = requireReminderExports();
  const dueAt = new Date(2026, 3, 30, 23, 59, 59, 999).getTime();

  const triggers = getReminderTriggersForDueDate(dueAt, "none");

  assert.deepEqual(triggers, []);
});

test("overdue reminders older than the catch-up window do not produce a trigger", () => {
  const { getLatestEligibleReminderTrigger } = requireReminderExports();
  const now = new Date(2026, 3, 30, 12, 0, 0, 0).getTime();
  const dueAt = new Date(2026, 3, 20, 23, 59, 59, 999).getTime();

  const trigger = getLatestEligibleReminderTrigger(
    dueAt,
    "same-day-9am",
    now,
  );

  assert.equal(trigger, null);
});

test("overdue reminders within the catch-up window still produce a trigger", () => {
  const { getLatestEligibleReminderTrigger } = requireReminderExports();
  const now = new Date(2026, 3, 30, 12, 0, 0, 0).getTime();
  const dueAt = new Date(2026, 3, 26, 23, 59, 59, 999).getTime();

  const trigger = getLatestEligibleReminderTrigger(
    dueAt,
    "same-day-9am",
    now,
  );

  assert.notEqual(trigger, null);
  assert.deepEqual(getLocalParts(trigger), {
    year: 2026,
    month: 3,
    day: 26,
    hour: 9,
    minute: 0,
  });
});

test("fired key is stable for the same trigger and different across trigger slots", () => {
  const { getReminderTriggersForDueDate, getReminderFireKey } = requireReminderExports();
  const dueAt = new Date(2026, 3, 30, 23, 59, 59, 999).getTime();
  const [previousDayTrigger, sameDayTrigger] = getReminderTriggersForDueDate(
    dueAt,
    "day-before-and-same-day-9am",
  );

  const firstKey = getReminderFireKey(
    dueAt,
    "day-before-and-same-day-9am",
    previousDayTrigger,
  );
  const repeatedKey = getReminderFireKey(
    dueAt,
    "day-before-and-same-day-9am",
    previousDayTrigger,
  );
  const laterSlotKey = getReminderFireKey(
    dueAt,
    "day-before-and-same-day-9am",
    sameDayTrigger,
  );

  assert.equal(typeof firstKey, "string");
  assert.ok(firstKey.length > 0);
  assert.equal(firstKey, repeatedKey);
  assert.notEqual(firstKey, laterSlotKey);
});