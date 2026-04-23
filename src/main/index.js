const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  clipboard,
  Tray,
  nativeImage,
} = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

let db;
let dbPath;
let lastClipboardText = "";
let mainWindow = null;
let tray = null;
let isQuitting = false;

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
    CREATE TABLE IF NOT EXISTS system_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  saveDatabase();
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// ==================== 剪贴板监听 ====================

function startClipboardMonitor() {
  lastClipboardText = clipboard.readText() || "";

  setInterval(() => {
    const current = clipboard.readText() || "";
    if (current && current.length > 0 && current !== lastClipboardText) {
      lastClipboardText = current;
      db.run(
        "INSERT INTO clipboard (content, content_type, created_at) VALUES (?, ?, ?)",
        [current, "text", Date.now()],
      );
      // 只保留最近50条记录
      db.run(
        "DELETE FROM clipboard WHERE id NOT IN (SELECT id FROM clipboard ORDER BY created_at DESC LIMIT 50)",
      );
      saveDatabase();
    }
  }, 1000);
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
      click: () => {
        win.show();
        win.focus();
      },
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
    win.show();
    win.focus();
  });
}

// ==================== 窗口 ====================

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-icon.png");
  }
  return path.join(__dirname, "..", "..", "assets", "app-icon.png");
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: "tOOls",
    frame: false,
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "..", "preload", "preload.js"),
    },
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  if (process.env.DEBUG_RENDERER) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const indexHtml = path.join(
      __dirname,
      "..",
      "renderer",
      "dist",
      "index.html",
    );
    mainWindow.loadFile(indexHtml);
  }

  createTray(mainWindow);
}

// ==================== 启动 ====================

app.whenReady().then(async () => {
  await loadDatabase();
  createWindow();
  startClipboardMonitor();
  collectSystemInfo();
});

app.on("before-quit", () => {
  isQuitting = true;
});

// ==================== IPC: 窗口控制 ====================

ipcMain.handle("window/minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window/close", () => {
  if (mainWindow) mainWindow.close();
});

// ==================== IPC: items ====================

ipcMain.handle("db/get-items", async () => {
  const results = db.exec(
    "SELECT id, title, created_at FROM items ORDER BY created_at DESC",
  );
  if (results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
});

ipcMain.handle("db/add-item", async (event, { title }) => {
  if (typeof title !== "string" || title.length === 0 || title.length > 500) {
    throw new Error("Invalid title");
  }
  db.run("INSERT INTO items (title, created_at) VALUES (?, ?)", [
    title,
    Date.now(),
  ]);
  saveDatabase();
  const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  return { id: lastId };
});

// ==================== IPC: clipboard ====================

ipcMain.handle("clipboard/get-history", async () => {
  const results = db.exec(
    "SELECT id, content, content_type, created_at FROM clipboard ORDER BY created_at DESC LIMIT 50",
  );
  if (results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
});

ipcMain.handle("clipboard/delete-item", async (event, id) => {
  db.run("DELETE FROM clipboard WHERE id = ?", [id]);
  saveDatabase();
});

ipcMain.handle("clipboard/clear-all", async () => {
  db.run("DELETE FROM clipboard");
  saveDatabase();
});

ipcMain.handle("clipboard/copy-to-system", async (event, content) => {
  clipboard.writeText(content);
  lastClipboardText = content;
});

// ==================== IPC: 待办列表 ====================

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

ipcMain.handle("todo/get-lists", async () => {
  return dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
});

ipcMain.handle("todo/add-list", async (event, { name }) => {
  if (!name || name.length > 100) throw new Error("Invalid list name");
  db.run(
    "INSERT INTO todo_lists (name, sort_order, created_at) VALUES (?, ?, ?)",
    [name, 99, Date.now()],
  );
  saveDatabase();
  const rows = dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
  return rows;
});

ipcMain.handle("todo/delete-list", async (event, { id }) => {
  db.run("DELETE FROM todo_lists WHERE id = ?", [id]);
  db.run("DELETE FROM todos WHERE list_id = ?", [id]);
  saveDatabase();
  return dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
});

ipcMain.handle("todo/rename-list", async (event, { id, name }) => {
  if (!name || name.length > 100) throw new Error("Invalid list name");
  db.run("UPDATE todo_lists SET name = ? WHERE id = ?", [name, id]);
  saveDatabase();
  return dbQueryAll("SELECT * FROM todo_lists ORDER BY sort_order ASC");
});

ipcMain.handle("todo/get-todos", async (event, { listId }) => {
  if (listId === "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    return dbQueryAll(
      "SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id WHERE t.created_at >= ? ORDER BY t.completed ASC, t.created_at DESC",
      [ts],
    );
  }
  if (listId === "important") {
    return dbQueryAll(
      "SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id WHERE t.list_id IN (SELECT id FROM todo_lists WHERE name = '重要') ORDER BY t.completed ASC, t.created_at DESC",
    );
  }
  if (listId === "completed") {
    return dbQueryAll(
      "SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id WHERE t.completed = 1 ORDER BY t.completed_at DESC",
    );
  }
  if (listId === "all") {
    return dbQueryAll(
      "SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id ORDER BY t.completed ASC, t.created_at DESC",
    );
  }
  // 指定列表
  return dbQueryAll(
    "SELECT t.*, l.name as list_name FROM todos t LEFT JOIN todo_lists l ON t.list_id = l.id WHERE t.list_id = ? ORDER BY t.completed ASC, t.created_at DESC",
    [listId],
  );
});

ipcMain.handle("todo/add", async (event, { title, listId }) => {
  if (!title || title.length > 500) throw new Error("Invalid title");
  const effectiveListId =
    listId &&
    listId !== "all" &&
    listId !== "today" &&
    listId !== "completed" &&
    listId !== "important"
      ? listId
      : null;
  db.run(
    "INSERT INTO todos (title, completed, list_id, created_at) VALUES (?, 0, ?, ?)",
    [title, effectiveListId, Date.now()],
  );
  saveDatabase();
  const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  return { id: lastId };
});

ipcMain.handle("todo/toggle", async (event, { id }) => {
  const rows = dbQueryAll("SELECT completed FROM todos WHERE id = ?", [id]);
  if (rows.length === 0) throw new Error("Todo not found");
  const newCompleted = rows[0].completed ? 0 : 1;
  const completedAt = newCompleted ? Date.now() : null;
  db.run("UPDATE todos SET completed = ?, completed_at = ? WHERE id = ?", [
    newCompleted,
    completedAt,
    id,
  ]);
  saveDatabase();
});

ipcMain.handle("todo/update", async (event, { id, title }) => {
  if (!title || title.length > 500) throw new Error("Invalid title");
  db.run("UPDATE todos SET title = ? WHERE id = ?", [title, id]);
  saveDatabase();
});

ipcMain.handle("todo/delete", async (event, { id }) => {
  db.run("DELETE FROM todos WHERE id = ?", [id]);
  saveDatabase();
});

// ==================== IPC: 图片查看器窗口 ====================

let viewerWindows = [];

ipcMain.handle("image-viewer/open", async (event, { src, alt }) => {
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

  // 先注册监听器，再加载页面，否则 did-finish-load 在 loadFile resolve 时已经触发过了
  viewerWindow.webContents.once("did-finish-load", () => {
    viewerWindow.webContents.send("image-data", { src, alt });
  });

  await viewerWindow.loadFile(viewerHtmlPath);
  viewerWindow.focus();
});

// ==================== 系统信息 ====================

function collectSystemInfo() {
  const now = Date.now();

  db.run("DELETE FROM system_info");

  // 网卡 IPv4，每个网卡一条记录
  const interfaces = os.networkInterfaces();
  let count = 0;
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        db.run(
          "INSERT INTO system_info (key, value, updated_at) VALUES (?, ?, ?)",
          ["ipv4_" + name, addr.address, now],
        );
        count++;
      }
    }
  }

  // 时间戳
  db.run("INSERT INTO system_info (key, value, updated_at) VALUES (?, ?, ?)", [
    "_updated_at",
    String(now),
    now,
  ]);
  saveDatabase();

  return getSystemInfoFromDB();
}

function getSystemInfoFromDB() {
  const rows = dbQueryAll("SELECT key, value, updated_at FROM system_info");
  if (rows.length === 0) return collectSystemInfo();

  const result = { interfaces: [], updated_at: 0 };
  for (const row of rows) {
    if (row.key === "_updated_at") {
      result.updated_at = row.updated_at;
    } else if (row.key.startsWith("ipv4_")) {
      result.interfaces.push({
        name: row.key.slice(5),
        ip: row.value,
      });
    }
  }
  return result;
}

ipcMain.handle("system/info", async () => {
  return getSystemInfoFromDB();
});

ipcMain.handle("system/refresh", async () => {
  return collectSystemInfo();
});

// 10分钟自动刷新
setInterval(
  () => {
    if (db && !isQuitting) {
      collectSystemInfo();
    }
  },
  10 * 60 * 1000,
);

// ==================== 退出 ====================

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
