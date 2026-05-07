const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  clipboard,
  globalShortcut,
  Tray,
  nativeImage,
  Notification,
} = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const {
  getLatestEligibleReminderTrigger,
  getReminderFireKey,
} = require("./lib/reminder-rules");
const {
  pickClipboardIdsToDelete,
} = require("./lib/clipboard-retention");
const {
  normalizeClipboardPatch,
} = require("./lib/clipboard-metadata");
const {
  normalizeMarkdownDocumentInput,
} = require("./lib/markdown-metadata");
const {
  normalizeQuickSheetAction,
} = require("./lib/quick-sheet");

let db;
let dbPath;
let lastClipboardText = "";
let mainWindow = null;
let quickSheetWindow = null;
let tray = null;
let isQuitting = false;
let reminderTimer = null;

const REMINDER_NONE_PRESET = "none";
const VALID_REMINDER_PRESETS = new Set([
  REMINDER_NONE_PRESET,
  "day-before-9am",
  "same-day-9am",
  "day-before-and-same-day-9am",
]);
const CLIPBOARD_HISTORY_LIMIT = 200;
const DEFAULT_QUICK_SHEET_ACCELERATOR = "CommandOrControl+Super+Z";
const QUICK_SHEET_RECENT_COPY_LIMIT = 3;

// ==================== 数据库 ====================

async function loadDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, file);
      }
      return path.join(
        __dirname,
        "..",
        "..",
        "node_modules",
        "sql.js",
        "dist",
        file,
      );
    },
  });

  dbPath = path.join(app.getPath("userData"), "app.sqlite");

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS clipboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'text',
      created_at INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      list_id INTEGER,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS markdown_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  ensureTodoSchema();
  ensureClipboardSchema();

  // 索引优化：加速高频查询
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_clipboard_created ON clipboard(created_at DESC)",
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_clipboard_reusable ON clipboard(is_favorite, created_at DESC)",
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_clipboard_last_used ON clipboard(last_used_at DESC)",
  );
  db.run("CREATE INDEX IF NOT EXISTS idx_todos_list_id ON todos(list_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)");
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at DESC)",
  );
  db.run("CREATE INDEX IF NOT EXISTS idx_todos_due_at ON todos(due_at)");
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_todos_priority_pin ON todos(is_pinned, priority)",
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_todo_lists_sort ON todo_lists(sort_order)",
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_markdown_documents_updated ON markdown_documents(updated_at DESC)",
  );

  // 兼容旧版：如果旧数据库有 system_info 表则删除
  db.run("DROP TABLE IF EXISTS system_info");

  scheduleSave();
}

// ==================== 批量延迟写盘 ====================

let dbDirty = false;
let saveTimer = null;

const TODO_ACTIVE_ORDER = `
  ORDER BY
    t.completed ASC,
    COALESCE(t.is_pinned, 0) DESC,
    COALESCE(t.priority, 1) DESC,
    CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END,
    t.due_at ASC,
    t.created_at DESC
`;
const MARKDOWN_SELECT_FIELDS = `
  id,
  title,
  content,
  tags_json,
  created_at,
  updated_at
`;
const CLIPBOARD_SELECT_FIELDS = `
  id,
  content,
  content_type,
  created_at,
  title,
  tags_json,
  is_favorite,
  updated_at,
  last_used_at
`;
function scheduleSave() {
  dbDirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (dbDirty) flushDatabase();
  }, 2000);
}

function flushDatabase() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!dbDirty || !db) return;
  dbDirty = false;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function flushDatabaseNow() {
  dbDirty = true;
  flushDatabase();
}

// ==================== 数据库查询工具 ====================

function dbQueryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function dbQueryOne(sql, params = []) {
  const rows = dbQueryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function getTableColumns(tableName) {
  return new Set(
    dbQueryAll(`PRAGMA table_info(${tableName})`).map((column) => column.name),
  );
}

function ensureColumn(tableName, columnName, definition) {
  const columns = getTableColumns(tableName);
  if (columns.has(columnName)) return false;
  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  return true;
}

function ensureTodoSchema() {
  let migrated = false;
  migrated = ensureColumn(
    "todos",
    "updated_at",
    "updated_at INTEGER NOT NULL DEFAULT 0",
  ) || migrated;
  migrated = ensureColumn(
    "todos",
    "priority",
    "priority INTEGER NOT NULL DEFAULT 1",
  ) || migrated;
  migrated = ensureColumn("todos", "note", "note TEXT DEFAULT ''") || migrated;
  migrated = ensureColumn(
    "todos",
    "is_pinned",
    "is_pinned INTEGER NOT NULL DEFAULT 0",
  ) || migrated;
  migrated = ensureColumn("todos", "due_at", "due_at INTEGER") || migrated;
  migrated = ensureColumn(
    "todos",
    "reminder_preset",
    "reminder_preset TEXT NOT NULL DEFAULT 'none'",
  ) || migrated;
  migrated = ensureColumn(
    "todos",
    "reminder_last_fired_at",
    "reminder_last_fired_at INTEGER NOT NULL DEFAULT 0",
  ) || migrated;
  migrated = ensureColumn(
    "todos",
    "reminder_last_fired_key",
    "reminder_last_fired_key TEXT NOT NULL DEFAULT ''",
  ) || migrated;
  migrated = ensureColumn(
    "todos",
    "reminder_dismissed_at",
    "reminder_dismissed_at INTEGER",
  ) || migrated;
  migrated = ensureColumn(
    "todos",
    "reminder_snoozed_until",
    "reminder_snoozed_until INTEGER",
  ) || migrated;

  if (!migrated) return;

  db.run(
    "UPDATE todos SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = 0",
  );
  db.run("UPDATE todos SET priority = 1 WHERE priority IS NULL");
  db.run("UPDATE todos SET note = '' WHERE note IS NULL");
  db.run("UPDATE todos SET is_pinned = 0 WHERE is_pinned IS NULL");
  db.run(
    "UPDATE todos SET reminder_preset = ? WHERE reminder_preset IS NULL OR reminder_preset = ''",
    [REMINDER_NONE_PRESET],
  );
  db.run(
    "UPDATE todos SET reminder_last_fired_at = 0 WHERE reminder_last_fired_at IS NULL",
  );
  db.run(
    "UPDATE todos SET reminder_last_fired_key = '' WHERE reminder_last_fired_key IS NULL",
  );
}

function ensureClipboardSchema() {
  let migrated = false;
  migrated = ensureColumn(
    "clipboard",
    "title",
    "title TEXT NOT NULL DEFAULT ''",
  ) || migrated;
  migrated = ensureColumn(
    "clipboard",
    "tags_json",
    "tags_json TEXT NOT NULL DEFAULT '[]'",
  ) || migrated;
  migrated = ensureColumn(
    "clipboard",
    "is_favorite",
    "is_favorite INTEGER NOT NULL DEFAULT 0",
  ) || migrated;
  migrated = ensureColumn(
    "clipboard",
    "updated_at",
    "updated_at INTEGER NOT NULL DEFAULT 0",
  ) || migrated;
  migrated = ensureColumn(
    "clipboard",
    "last_used_at",
    "last_used_at INTEGER",
  ) || migrated;

  if (!migrated) return;

  db.run("UPDATE clipboard SET title = '' WHERE title IS NULL");
  db.run(
    "UPDATE clipboard SET tags_json = '[]' WHERE tags_json IS NULL OR tags_json = ''",
  );
  db.run("UPDATE clipboard SET is_favorite = 0 WHERE is_favorite IS NULL");
  db.run(
    "UPDATE clipboard SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = 0",
  );
}

function normalizeListId(listId) {
  return listId &&
    listId !== "all" &&
    listId !== "today" &&
    listId !== "completed" &&
    listId !== "important"
    ? listId
    : null;
}

function normalizePriority(priority) {
  const parsed = Number(priority);
  if (![0, 1, 2].includes(parsed)) {
    throw new Error("Invalid priority");
  }
  return parsed;
}

function normalizeDueAt(dueAt) {
  if (dueAt === null || dueAt === undefined || dueAt === "") return null;
  if (typeof dueAt !== "number" || Number.isNaN(dueAt)) {
    throw new Error("Invalid dueAt");
  }
  return dueAt;
}

function normalizeClipboardId(id) {
  if (typeof id !== "number" || Number.isNaN(id)) {
    throw new Error("Invalid id");
  }

  return id;
}

function normalizeMarkdownDocumentId(id) {
  if (typeof id !== "number" || Number.isNaN(id) || id <= 0) {
    throw new Error("Invalid markdown document id");
  }

  return id;
}

function buildClipboardUpdateStatement(patch) {
  const assignments = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    assignments.push("title = ?");
    params.push(patch.title);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
    assignments.push("tags_json = ?");
    params.push(JSON.stringify(patch.tags));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "isFavorite")) {
    assignments.push("is_favorite = ?");
    params.push(patch.isFavorite ? 1 : 0);
  }

  return { assignments, params };
}

function getClipboardHistoryRows() {
  return dbQueryAll(
    `SELECT ${CLIPBOARD_SELECT_FIELDS}
     FROM clipboard
     WHERE COALESCE(is_favorite, 0) = 1
        OR id IN (
          SELECT id
          FROM clipboard
          WHERE COALESCE(is_favorite, 0) = 0
          ORDER BY created_at DESC
          LIMIT ?
        )
     ORDER BY created_at DESC`,
    [CLIPBOARD_HISTORY_LIMIT],
  );
}

function getReusableClipboardRows() {
  return dbQueryAll(
    `SELECT ${CLIPBOARD_SELECT_FIELDS}
     FROM clipboard
     WHERE COALESCE(is_favorite, 0) = 1
     ORDER BY COALESCE(last_used_at, 0) DESC,
              COALESCE(updated_at, created_at) DESC,
              created_at DESC`,
  );
}

function getClipboardItemById(id) {
  return dbQueryOne(
    `SELECT ${CLIPBOARD_SELECT_FIELDS}
     FROM clipboard
     WHERE id = ?`,
    [id],
  );
}

function getMarkdownDocumentRows() {
  return dbQueryAll(
    `SELECT ${MARKDOWN_SELECT_FIELDS}
     FROM markdown_documents
     ORDER BY updated_at DESC, created_at DESC`,
  );
}

function getMarkdownDocumentById(id) {
  return dbQueryOne(
    `SELECT ${MARKDOWN_SELECT_FIELDS}
     FROM markdown_documents
     WHERE id = ?`,
    [id],
  );
}

function saveMarkdownDocumentRecord(payload) {
  const documentInput = normalizeMarkdownDocumentInput(payload || {});
  const timestamp = Date.now();
  const tagsJson = JSON.stringify(documentInput.tags);

  if (documentInput.id === null) {
    db.run(
      `INSERT INTO markdown_documents (
         title,
         content,
         tags_json,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        documentInput.title,
        documentInput.content,
        tagsJson,
        timestamp,
        timestamp,
      ],
    );
    scheduleSave();
    const row = dbQueryOne("SELECT last_insert_rowid() as id");
    if (!row) {
      throw new Error("Failed to create markdown document");
    }
    return getMarkdownDocumentById(row.id);
  }

  const normalizedId = normalizeMarkdownDocumentId(documentInput.id);
  const existingDocument = getMarkdownDocumentById(normalizedId);
  if (!existingDocument) {
    throw new Error("Markdown document not found");
  }

  db.run(
    `UPDATE markdown_documents
     SET title = ?,
         content = ?,
         tags_json = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      documentInput.title,
      documentInput.content,
      tagsJson,
      timestamp,
      normalizedId,
    ],
  );
  scheduleSave();
  return getMarkdownDocumentById(normalizedId);
}

function copyClipboardContentToSystem(content, itemId = null) {
  lastClipboardText = content;
  clipboard.writeText(content);

  if (itemId === null || itemId === undefined) {
    return;
  }

  db.run("UPDATE clipboard SET last_used_at = ? WHERE id = ?", [
    Date.now(),
    itemId,
  ]);
  scheduleSave();
  emitClipboardHistoryChanged();
}

function cleanupClipboardHistory() {
  const rows = dbQueryAll(
    `SELECT id, created_at, is_favorite
     FROM clipboard`,
  );
  const idsToDelete = pickClipboardIdsToDelete(rows, CLIPBOARD_HISTORY_LIMIT);
  if (idsToDelete.length === 0) {
    return;
  }

  db.run(
    `DELETE FROM clipboard WHERE id IN (${idsToDelete.map(() => "?").join(", ")})`,
    idsToDelete,
  );
}

function normalizeReminderPreset(preset, dueAt) {
  if (dueAt === null) return REMINDER_NONE_PRESET;

  const nextPreset =
    typeof preset === "string" && preset.length > 0
      ? preset
      : REMINDER_NONE_PRESET;
  if (!VALID_REMINDER_PRESETS.has(nextPreset)) {
    throw new Error("Invalid reminderPreset");
  }
  return nextPreset;
}

function appendReminderStateReset(assignments, params) {
  assignments.push(
    "reminder_last_fired_at = ?",
    "reminder_last_fired_key = ?",
    "reminder_dismissed_at = ?",
    "reminder_snoozed_until = ?",
  );
  params.push(0, "", null, null);
}

function getDayWindow(timestamp = Date.now()) {
  const dayStart = new Date(timestamp);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { start: dayStart.getTime(), end: dayEnd.getTime() };
}

function getTaskDayKey(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTodoReferenceTimestamp(todo) {
  return todo.due_at || todo.created_at;
}

function getFocusLabel(completionRate, activeCount) {
  if (activeCount === 0) return "今天的收尾已经完成";
  if (completionRate >= 75) return "专注状态良好";
  if (completionRate >= 40) return "推进节奏稳定";
  return "优先处理关键事项";
}

function getTodoWorkspaceData() {
  const rows = dbQueryAll(
    `SELECT t.*, l.name as list_name
     FROM todos t
     LEFT JOIN todo_lists l ON t.list_id = l.id
     ${TODO_ACTIVE_ORDER}`,
  );
  const { start, end } = getDayWindow();
  const total = rows.length;
  const done = rows.filter((todo) => todo.completed).length;
  const active = total - done;
  const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);
  const activeTodos = rows.filter((todo) => !todo.completed);
  const recentCompleted = rows
    .filter((todo) => todo.completed)
    .sort((left, right) => (right.completed_at || 0) - (left.completed_at || 0))
    .slice(0, 3);

  return {
    summary: {
      total,
      done,
      active,
      completionRate,
      focusLabel: getFocusLabel(completionRate, active),
    },
    quickFilters: [
      {
        id: "today",
        label: "今天到期",
        count: activeTodos.filter((todo) => {
          const reference = getTodoReferenceTimestamp(todo);
          return reference >= start && reference < end;
        }).length,
      },
      {
        id: "pinned",
        label: "已置顶",
        count: activeTodos.filter((todo) => Number(todo.is_pinned) === 1).length,
      },
      {
        id: "high",
        label: "高优先级",
        count: activeTodos.filter((todo) => Number(todo.priority) === 2).length,
      },
      {
        id: "completed",
        label: "已完成",
        count: done,
      },
    ],
    recentCompleted,
    calendarDots: Array.from(
      new Set(
        activeTodos
          .map((todo) => getTaskDayKey(getTodoReferenceTimestamp(todo)))
          .filter(Boolean),
      ),
    ),
  };
}

function getReminderNotificationBody(todo, triggerAt) {
  const dueDate = new Date(todo.due_at);
  const triggerDate = new Date(triggerAt);
  const isDueToday =
    dueDate.getFullYear() === triggerDate.getFullYear() &&
    dueDate.getMonth() === triggerDate.getMonth() &&
    dueDate.getDate() === triggerDate.getDate();
  const dueLabel = isDueToday ? "今天到期" : "明天到期";
  return `${todo.title} · ${dueLabel} · 09:00 提醒`;
}

function createTodoRecord({
  title,
  listId,
  priority = 1,
  note = "",
  dueAt = null,
  isPinned = false,
  reminderPreset = REMINDER_NONE_PRESET,
}) {
  if (!title || title.length > 500) throw new Error("Invalid title");
  const timestamp = Date.now();
  const normalizedDueAt = normalizeDueAt(dueAt);
  const normalizedReminderPreset = normalizeReminderPreset(
    reminderPreset,
    normalizedDueAt,
  );

  db.run(
    `INSERT INTO todos (
       title,
       completed,
       list_id,
       created_at,
       updated_at,
       priority,
       note,
       is_pinned,
       due_at,
       reminder_preset,
       reminder_last_fired_at,
       reminder_last_fired_key,
       reminder_dismissed_at,
       reminder_snoozed_until
     )
     VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', NULL, NULL)`,
    [
      title.trim(),
      normalizeListId(listId),
      timestamp,
      timestamp,
      normalizePriority(priority),
      typeof note === "string" ? note.trim() : "",
      isPinned ? 1 : 0,
      normalizedDueAt,
      normalizedReminderPreset,
    ],
  );
  scheduleSave();
  const row = dbQueryOne("SELECT last_insert_rowid() as id");
  if (!row) throw new Error("Failed to add todo");
  return { id: row.id };
}

function showTodoReminderNotification(todo, triggerAt, fireKey) {
  const notification = new Notification({
    title: "tOOls Todo Reminder",
    body: getReminderNotificationBody(todo, triggerAt),
  });

  notification.on("click", () => {
    focusMainWindow();
    emitAppNavigate({
      menuId: "todo",
      todoId: todo.id,
      listId:
        todo.list_id === null || todo.list_id === undefined
          ? "all"
          : String(todo.list_id),
    });
  });

  notification.show();

  const firedAt = Date.now();
  db.run(
    `UPDATE todos
     SET reminder_last_fired_at = ?,
         reminder_last_fired_key = ?,
         reminder_dismissed_at = ?,
         reminder_snoozed_until = ?,
         updated_at = ?
     WHERE id = ?`,
    [firedAt, fireKey, null, null, firedAt, todo.id],
  );
  flushDatabaseNow();
}

function runReminderCheck() {
  try {
    const now = Date.now();
    const activeTodos = dbQueryAll(
      `SELECT t.*, l.name as list_name
       FROM todos t
       LEFT JOIN todo_lists l ON t.list_id = l.id
       WHERE t.completed = 0
         AND t.due_at IS NOT NULL
         AND COALESCE(t.reminder_preset, ?) != ?`,
      [REMINDER_NONE_PRESET, REMINDER_NONE_PRESET],
    );

    for (const todo of activeTodos) {
      if (Number(todo.reminder_snoozed_until || 0) > now) {
        continue;
      }

      const triggerAt = getLatestEligibleReminderTrigger(
        todo.due_at,
        todo.reminder_preset,
        now,
      );
      if (!triggerAt) {
        continue;
      }

      if (Number(todo.reminder_dismissed_at || 0) >= triggerAt) {
        continue;
      }

      const fireKey = getReminderFireKey(
        todo.due_at,
        todo.reminder_preset,
        triggerAt,
      );
      if ((todo.reminder_last_fired_key || "") === fireKey) {
        continue;
      }

      showTodoReminderNotification(todo, triggerAt, fireKey);
    }
  } catch (error) {
    console.error("Reminder check failed", error);
  }
}

function startReminderMonitor() {
  if (reminderTimer) return;
  runReminderCheck();
  reminderTimer = setInterval(runReminderCheck, 60_000);
}

// ==================== 剪贴板监听 ====================

function emitClipboardHistoryChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { webContents } = mainWindow;
  if (!webContents || webContents.isDestroyed()) return;
  webContents.send("clipboard/history-changed");
}

function startClipboardMonitor() {
  lastClipboardText = clipboard.readText() || "";

  setInterval(() => {
    const current = clipboard.readText() || "";
    if (current && current.length > 0 && current !== lastClipboardText) {
      lastClipboardText = current;
      const createdAt = Date.now();
      db.run(
        `INSERT INTO clipboard (
           content,
           content_type,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?)`,
        [current, "text", createdAt, createdAt],
      );
      cleanupClipboardHistory();
      scheduleSave();
      emitClipboardHistoryChanged();
    }
  }, 3000);
}

// ==================== 托盘图标 ====================

function getTrayIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "tray-icon.png");
  }
  return path.join(__dirname, "..", "..", "assets", "tray-icon.png");
}

function createTray(win) {
  const iconPath = getTrayIconPath();

  if (!fs.existsSync(iconPath)) {
    console.warn("Tray icon not found:", iconPath);
    return;
  }

  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("tOOls");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: () => focusMainWindow(),
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    focusMainWindow();
  });
}

// ==================== 窗口 ====================

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-icon.png");
  }
  return path.join(__dirname, "..", "..", "assets", "app-icon.png");
}

function getSharedWebPreferences() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    preload: path.join(__dirname, "..", "preload", "preload.js"),
  };
}

function getRendererEntryFilePath() {
  return path.join(__dirname, "..", "renderer", "dist", "index.html");
}

function loadRendererWindow(targetWindow, hash = "") {
  if (process.env.DEBUG_RENDERER) {
    const targetHash = hash ? `#${hash}` : "";
    targetWindow.loadURL(`http://localhost:5173/${targetHash}`);
    return;
  }

  const indexHtml = getRendererEntryFilePath();
  if (hash) {
    targetWindow.loadFile(indexHtml, { hash });
    return;
  }

  targetWindow.loadFile(indexHtml);
}

function focusWindow(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  if (targetWindow.isMinimized()) {
    targetWindow.restore();
  }
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
}

function focusMainWindow() {
  focusWindow(mainWindow);
}

function hideQuickSheetWindow() {
  if (!quickSheetWindow || quickSheetWindow.isDestroyed()) return;
  quickSheetWindow.hide();
}

function emitQuickSheetRefresh() {
  if (!quickSheetWindow || quickSheetWindow.isDestroyed()) return;
  const { webContents } = quickSheetWindow;
  if (!webContents || webContents.isDestroyed()) return;
  webContents.send("quick-sheet/refresh-model");
}

function emitAppNavigate(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { webContents } = mainWindow;
  if (!webContents || webContents.isDestroyed()) return;
  webContents.send("app/navigate", payload);
}

function toggleQuickSheetWindow() {
  if (!quickSheetWindow || quickSheetWindow.isDestroyed()) {
    return;
  }

  if (quickSheetWindow.isVisible() && quickSheetWindow.isFocused()) {
    quickSheetWindow.hide();
    return;
  }

  emitQuickSheetRefresh();
  quickSheetWindow.center();
  quickSheetWindow.show();
  quickSheetWindow.focus();
}

function registerQuickSheetShortcut() {
  const registered = globalShortcut.register(
    DEFAULT_QUICK_SHEET_ACCELERATOR,
    toggleQuickSheetWindow,
  );

  if (!registered) {
    console.warn(
      "Failed to register quick sheet shortcut:",
      DEFAULT_QUICK_SHEET_ACCELERATOR,
    );
  }
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    title: "tOOls",
    frame: false,
    icon: getAppIconPath(),
    webPreferences: getSharedWebPreferences(),
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  loadRendererWindow(mainWindow);

  createTray(mainWindow);
}

function createQuickSheetWindow() {
  quickSheetWindow = new BrowserWindow({
    width: 460,
    height: 380,
    minWidth: 460,
    minHeight: 380,
    show: false,
    center: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "tOOls Quick Sheet",
    icon: getAppIconPath(),
    webPreferences: getSharedWebPreferences(),
  });

  quickSheetWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      quickSheetWindow.hide();
    }
  });

  quickSheetWindow.on("blur", () => {
    if (!isQuitting && quickSheetWindow && !quickSheetWindow.isDestroyed()) {
      quickSheetWindow.hide();
    }
  });

  loadRendererWindow(quickSheetWindow, "quick-sheet");
}

// ==================== 启动 ====================

app.whenReady().then(async () => {
  await loadDatabase();
  createWindow();
  createQuickSheetWindow();
  registerQuickSheetShortcut();
  startClipboardMonitor();
  startReminderMonitor();
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  flushDatabase();
});

function getEventWindow(event) {
  if (!event?.sender) return null;
  return BrowserWindow.fromWebContents(event.sender);
}

// ==================== IPC: 窗口控制 ====================

ipcMain.handle("window/minimize", (event) => {
  const targetWindow = getEventWindow(event) || mainWindow;
  if (targetWindow) {
    targetWindow.minimize();
  }
});

ipcMain.handle("window/close", (event) => {
  const targetWindow = getEventWindow(event) || mainWindow;
  if (targetWindow) {
    targetWindow.close();
  }
});

// ==================== IPC: items ====================

ipcMain.handle("db/get-items", async () => {
  return dbQueryAll(
    "SELECT id, title, created_at FROM items ORDER BY created_at DESC",
  );
});

ipcMain.handle("db/add-item", async (event, { title }) => {
  if (typeof title !== "string" || title.length === 0 || title.length > 500) {
    throw new Error("Invalid title");
  }
  db.run("INSERT INTO items (title, created_at) VALUES (?, ?)", [
    title,
    Date.now(),
  ]);
  scheduleSave();
  const row = dbQueryOne("SELECT last_insert_rowid() as id");
  if (!row) throw new Error("Failed to insert item");
  return { id: row.id };
});

// ==================== IPC: clipboard ====================

ipcMain.handle("markdown/get-documents", async () => {
  return getMarkdownDocumentRows();
});

ipcMain.handle("markdown/save-document", async (event, payload) => {
  return saveMarkdownDocumentRecord(payload || {});
});

ipcMain.handle("clipboard/get-history", async () => {
  return getClipboardHistoryRows();
});

ipcMain.handle("clipboard/get-reusable-items", async () => {
  return getReusableClipboardRows();
});

ipcMain.handle("clipboard/update-item", async (event, { id, patch }) => {
  const normalizedId = normalizeClipboardId(id);
  const existingItem = getClipboardItemById(normalizedId);
  if (!existingItem) {
    throw new Error("Clipboard item not found");
  }

  const normalizedPatch = normalizeClipboardPatch(patch || {});
  const { assignments, params } = buildClipboardUpdateStatement(normalizedPatch);
  if (assignments.length === 0) {
    return existingItem;
  }

  assignments.push("updated_at = ?");
  params.push(Date.now(), normalizedId);
  db.run(
    `UPDATE clipboard SET ${assignments.join(", ")} WHERE id = ?`,
    params,
  );
  cleanupClipboardHistory();
  scheduleSave();
  emitClipboardHistoryChanged();
  return getClipboardItemById(normalizedId);
});

ipcMain.handle("clipboard/delete-item", async (event, id) => {
  const normalizedId = normalizeClipboardId(id);
  db.run("DELETE FROM clipboard WHERE id = ?", [normalizedId]);
  scheduleSave();
  emitClipboardHistoryChanged();
});

ipcMain.handle("clipboard/clear-all", async () => {
  db.run(
    `DELETE FROM clipboard
     WHERE COALESCE(is_favorite, 0) = 0`,
  );
  scheduleSave();
  emitClipboardHistoryChanged();
});

ipcMain.handle("clipboard/copy-to-system", async (event, payload) => {
  const normalizedPayload =
    typeof payload === "string"
      ? { content: payload, itemId: null }
      : payload && typeof payload === "object"
        ? payload
        : null;
  if (!normalizedPayload || typeof normalizedPayload.content !== "string") {
    throw new Error("Invalid content");
  }

  const normalizedItemId =
    normalizedPayload.itemId === null || normalizedPayload.itemId === undefined
      ? null
      : normalizeClipboardId(normalizedPayload.itemId);

  copyClipboardContentToSystem(normalizedPayload.content, normalizedItemId);
});

ipcMain.handle("quick-sheet/get-model", async () => {
  return {
    accelerator: DEFAULT_QUICK_SHEET_ACCELERATOR,
    recentReusableItems: getClipboardHistoryRows().slice(0, QUICK_SHEET_RECENT_COPY_LIMIT),
  };
});

ipcMain.handle("quick-sheet/run-action", async (event, payload) => {
  const action = normalizeQuickSheetAction(payload || {});

  if (action.type === "open-main-window") {
    focusMainWindow();
    hideQuickSheetWindow();
    return { ok: true };
  }

  if (action.type === "create-todo") {
    const createdTodo = createTodoRecord({
      title: action.title,
      listId: action.listId,
    });
    hideQuickSheetWindow();
    return { ok: true, todoId: createdTodo.id };
  }

  const clipboardItem = getClipboardItemById(action.itemId);
  if (!clipboardItem) {
    throw new Error("Clipboard item not found");
  }

  copyClipboardContentToSystem(clipboardItem.content, clipboardItem.id);
  hideQuickSheetWindow();
  return { ok: true, itemId: clipboardItem.id };
});

// ==================== IPC: 待办列表 ====================

ipcMain.handle("todo/get-lists", async () => {
  return dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
});

ipcMain.handle("todo/get-workspace", async () => {
  return getTodoWorkspaceData();
});

ipcMain.handle("todo/add-list", async (event, { name }) => {
  if (!name || name.length > 100) throw new Error("Invalid list name");
  db.run(
    "INSERT INTO todo_lists (name, sort_order, created_at) VALUES (?, ?, ?)",
    [name, 99, Date.now()],
  );
  scheduleSave();
  return dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
});

ipcMain.handle("todo/delete-list", async (event, { id }) => {
  db.run("DELETE FROM todo_lists WHERE id = ?", [id]);
  db.run("DELETE FROM todos WHERE list_id = ?", [id]);
  scheduleSave();
  return dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
});

ipcMain.handle("todo/rename-list", async (event, { id, name }) => {
  if (!name || name.length > 100) throw new Error("Invalid list name");
  db.run("UPDATE todo_lists SET name = ? WHERE id = ?", [name, id]);
  scheduleSave();
  return dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
});

ipcMain.handle("todo/get-todos", async (event, { listId }) => {
  if (listId === "today") {
    const { start, end } = getDayWindow();
    return dbQueryAll(
      `SELECT t.*, l.name as list_name
       FROM todos t
       LEFT JOIN todo_lists l ON t.list_id = l.id
       WHERE (
         (t.due_at IS NOT NULL AND t.due_at >= ? AND t.due_at < ?)
         OR (t.due_at IS NULL AND t.created_at >= ? AND t.created_at < ?)
       )
       ${TODO_ACTIVE_ORDER}`,
      [start, end, start, end],
    );
  }
  if (listId === "important") {
    return dbQueryAll(
      `SELECT t.*, l.name as list_name
       FROM todos t
       LEFT JOIN todo_lists l ON t.list_id = l.id
       WHERE COALESCE(t.is_pinned, 0) = 1 OR COALESCE(t.priority, 1) = 2
       ${TODO_ACTIVE_ORDER}`,
    );
  }
  if (listId === "completed") {
    return dbQueryAll(
      "SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id WHERE t.completed = 1 ORDER BY t.completed_at DESC",
    );
  }
  if (listId === "all") {
    return dbQueryAll(
      `SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id ${TODO_ACTIVE_ORDER}`,
    );
  }
  return dbQueryAll(
    `SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id WHERE t.list_id = ? ${TODO_ACTIVE_ORDER}`,
    [listId],
  );
});

ipcMain.handle(
  "todo/add",
  async (event, payload) => {
    return createTodoRecord(payload || {});
  },
);

ipcMain.handle("todo/toggle", async (event, { id }) => {
  if (typeof id !== "number") throw new Error("Invalid id");
  const row = dbQueryOne("SELECT completed FROM todos WHERE id = ?", [id]);
  if (!row) throw new Error("Todo not found");
  const newCompleted = row.completed ? 0 : 1;
  const completedAt = newCompleted ? Date.now() : null;
  db.run("UPDATE todos SET completed = ?, completed_at = ? WHERE id = ?", [
    newCompleted,
    completedAt,
    id,
  ]);
  db.run("UPDATE todos SET updated_at = ? WHERE id = ?", [Date.now(), id]);
  scheduleSave();
});

ipcMain.handle("todo/update", async (event, { id, title, patch }) => {
  if (typeof id !== "number") throw new Error("Invalid id");
  const currentRow = dbQueryOne(
    "SELECT due_at, reminder_preset FROM todos WHERE id = ?",
    [id],
  );
  if (!currentRow) throw new Error("Todo not found");

  const currentDueAt = currentRow.due_at ?? null;
  const currentReminderPreset =
    currentRow.reminder_preset || REMINDER_NONE_PRESET;
  const nextPatch = patch && typeof patch === "object" ? { ...patch } : {};
  if (typeof title === "string") {
    nextPatch.title = title;
  }

  const hasDueAtPatch = Object.prototype.hasOwnProperty.call(nextPatch, "dueAt");
  const hasReminderPresetPatch = Object.prototype.hasOwnProperty.call(
    nextPatch,
    "reminderPreset",
  );
  let nextDueAt = currentDueAt;
  let nextReminderPreset = currentReminderPreset;

  if (hasDueAtPatch) {
    nextDueAt = normalizeDueAt(nextPatch.dueAt);
  }

  if (hasReminderPresetPatch) {
    nextReminderPreset = normalizeReminderPreset(
      nextPatch.reminderPreset,
      nextDueAt,
    );
  } else if (hasDueAtPatch) {
    nextReminderPreset = normalizeReminderPreset(currentReminderPreset, nextDueAt);
  }

  const assignments = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(nextPatch, "title")) {
    const nextTitle = String(nextPatch.title || "").trim();
    if (!nextTitle || nextTitle.length > 500) throw new Error("Invalid title");
    assignments.push("title = ?");
    params.push(nextTitle);
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, "priority")) {
    assignments.push("priority = ?");
    params.push(normalizePriority(nextPatch.priority));
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, "note")) {
    if (typeof nextPatch.note !== "string" || nextPatch.note.length > 2000) {
      throw new Error("Invalid note");
    }
    assignments.push("note = ?");
    params.push(nextPatch.note.trim());
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, "isPinned")) {
    assignments.push("is_pinned = ?");
    params.push(nextPatch.isPinned ? 1 : 0);
  }

  if (hasDueAtPatch) {
    assignments.push("due_at = ?");
    params.push(nextDueAt);
  }

  if (
    hasReminderPresetPatch ||
    (hasDueAtPatch && nextReminderPreset !== currentReminderPreset)
  ) {
    assignments.push("reminder_preset = ?");
    params.push(nextReminderPreset);
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, "listId")) {
    assignments.push("list_id = ?");
    params.push(normalizeListId(nextPatch.listId));
  }

  if (
    nextDueAt !== currentDueAt ||
    nextReminderPreset !== currentReminderPreset
  ) {
    appendReminderStateReset(assignments, params);
  }

  if (assignments.length === 0) return;

  assignments.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);
  db.run(`UPDATE todos SET ${assignments.join(", ")} WHERE id = ?`, params);
  scheduleSave();
});

ipcMain.handle("todo/delete", async (event, { id }) => {
  if (typeof id !== "number") throw new Error("Invalid id");
  db.run("DELETE FROM todos WHERE id = ?", [id]);
  scheduleSave();
});

ipcMain.handle("todo/snooze-reminder", async (event, { id, until }) => {
  if (typeof id !== "number") throw new Error("Invalid id");
  if (typeof until !== "number" || Number.isNaN(until)) {
    throw new Error("Invalid until");
  }
  const updatedAt = Date.now();
  db.run(
    `UPDATE todos
     SET reminder_snoozed_until = ?,
         reminder_dismissed_at = ?,
         reminder_last_fired_at = ?,
         reminder_last_fired_key = ?,
         updated_at = ?
     WHERE id = ?`,
    [until, null, 0, "", updatedAt, id],
  );
  scheduleSave();
});

ipcMain.handle("todo/dismiss-reminder", async (event, { id }) => {
  if (typeof id !== "number") throw new Error("Invalid id");
  const updatedAt = Date.now();
  db.run(
    `UPDATE todos
     SET reminder_dismissed_at = ?,
         reminder_snoozed_until = ?,
         updated_at = ?
     WHERE id = ?`,
    [updatedAt, null, updatedAt, id],
  );
  scheduleSave();
});

// ==================== IPC: 图片查看器窗口 ====================

let viewerWindows = [];
const MAX_VIEWER_WINDOWS = 5;

ipcMain.handle("image-viewer/open", async (event, { src, alt }) => {
  if (viewerWindows.length >= MAX_VIEWER_WINDOWS) {
    viewerWindows[0].focus();
    return;
  }
  const viewerWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: alt || "图片预览",
    frame: false,
    backgroundColor: "#1a1a1a",
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "..", "preload", "preload.js"),
    },
  });

  viewerWindow.on("closed", () => {
    viewerWindows = viewerWindows.filter((w) => w !== viewerWindow);
  });

  viewerWindows.push(viewerWindow);

  const viewerHtmlPath = path.join(
    __dirname,
    "..",
    "renderer",
    "image-viewer.html",
  );

  viewerWindow.webContents.once("did-finish-load", () => {
    viewerWindow.webContents.send("image-data", { src, alt });
  });

  await viewerWindow.loadFile(viewerHtmlPath);
  viewerWindow.focus();
});

// ==================== 系统信息（实时读取，不写数据库） ====================

function collectSystemInfo() {
  const now = Date.now();
  const interfaces = os.networkInterfaces();
  const result = { interfaces: [], updated_at: now };

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        result.interfaces.push({ name, ip: addr.address });
      }
    }
  }

  return result;
}

ipcMain.handle("system/info", async () => {
  return collectSystemInfo();
});

ipcMain.handle("system/refresh", async () => {
  return collectSystemInfo();
});

// ==================== 退出 ====================

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    flushDatabase();
    app.quit();
  }
});
