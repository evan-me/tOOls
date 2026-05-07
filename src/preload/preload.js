const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("window/minimize"),
  closeWindow: () => ipcRenderer.invoke("window/close"),

  // Items
  getItems: () => ipcRenderer.invoke("db/get-items"),
  addItem: (title) => ipcRenderer.invoke("db/add-item", { title }),

  // Markdown
  getMarkdownDocuments: () => ipcRenderer.invoke("markdown/get-documents"),
  saveMarkdownDocument: (payload) =>
    ipcRenderer.invoke("markdown/save-document", payload),

  // Clipboard
  getClipboardHistory: () => ipcRenderer.invoke("clipboard/get-history"),
  getReusableClipboardItems: () =>
    ipcRenderer.invoke("clipboard/get-reusable-items"),
  deleteClipboardItem: (id) => ipcRenderer.invoke("clipboard/delete-item", id),
  clearClipboardHistory: () => ipcRenderer.invoke("clipboard/clear-all"),
  updateClipboardItem: (id, patch) =>
    ipcRenderer.invoke("clipboard/update-item", { id, patch }),
  copyToSystem: (content, options = {}) =>
    ipcRenderer.invoke("clipboard/copy-to-system", {
      content,
      itemId: options.itemId ?? null,
    }),
  onClipboardHistoryChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("clipboard/history-changed", handler);
    return () => ipcRenderer.removeListener("clipboard/history-changed", handler);
  },
  getQuickSheetModel: () => ipcRenderer.invoke("quick-sheet/get-model"),
  runQuickSheetAction: (payload) =>
    ipcRenderer.invoke("quick-sheet/run-action", payload),
  onQuickSheetRefresh: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("quick-sheet/refresh-model", handler);
    return () =>
      ipcRenderer.removeListener("quick-sheet/refresh-model", handler);
  },

  // Todo
  getTodoLists: () => ipcRenderer.invoke("todo/get-lists"),
  getTodoWorkspace: () => ipcRenderer.invoke("todo/get-workspace"),
  addTodoList: (name) => ipcRenderer.invoke("todo/add-list", { name }),
  deleteTodoList: (id) => ipcRenderer.invoke("todo/delete-list", { id }),
  renameTodoList: (id, name) =>
    ipcRenderer.invoke("todo/rename-list", { id, name }),
  getTodos: (listId) => ipcRenderer.invoke("todo/get-todos", { listId }),
  addTodo: (title, listId, options = {}) =>
    ipcRenderer.invoke("todo/add", { title, listId, ...options }),
  toggleTodo: (id) => ipcRenderer.invoke("todo/toggle", { id }),
  updateTodo: (id, value) => {
    if (typeof value === "string") {
      return ipcRenderer.invoke("todo/update", { id, title: value });
    }
    return ipcRenderer.invoke("todo/update", { id, patch: value || {} });
  },
  deleteTodo: (id) => ipcRenderer.invoke("todo/delete", { id }),
  snoozeTodoReminder: (id, until) =>
    ipcRenderer.invoke("todo/snooze-reminder", { id, until }),
  dismissTodoReminder: (id) =>
    ipcRenderer.invoke("todo/dismiss-reminder", { id }),
  onAppNavigate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("app/navigate", handler);
    return () => ipcRenderer.removeListener("app/navigate", handler);
  },

  // Image Viewer
  openImageViewer: (src, alt) =>
    ipcRenderer.invoke("image-viewer/open", { src, alt }),
  onImageData: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("image-data", handler);
    return () => ipcRenderer.removeListener("image-data", handler);
  },

  // System Info
  getSystemInfo: () => ipcRenderer.invoke("system/info"),
  refreshSystemInfo: () => ipcRenderer.invoke("system/refresh"),
});
