const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("window/minimize"),
  closeWindow: () => ipcRenderer.invoke("window/close"),

  // Items
  getItems: () => ipcRenderer.invoke("db/get-items"),
  addItem: (title) => ipcRenderer.invoke("db/add-item", { title }),

  // Clipboard
  getClipboardHistory: () => ipcRenderer.invoke("clipboard/get-history"),
  deleteClipboardItem: (id) => ipcRenderer.invoke("clipboard/delete-item", id),
  clearClipboardHistory: () => ipcRenderer.invoke("clipboard/clear-all"),
  copyToSystem: (content) =>
    ipcRenderer.invoke("clipboard/copy-to-system", content),

  // Todo
  getTodoLists: () => ipcRenderer.invoke("todo/get-lists"),
  addTodoList: (name) => ipcRenderer.invoke("todo/add-list", { name }),
  deleteTodoList: (id) => ipcRenderer.invoke("todo/delete-list", { id }),
  renameTodoList: (id, name) =>
    ipcRenderer.invoke("todo/rename-list", { id, name }),
  getTodos: (listId) => ipcRenderer.invoke("todo/get-todos", { listId }),
  addTodo: (title, listId) => ipcRenderer.invoke("todo/add", { title, listId }),
  toggleTodo: (id) => ipcRenderer.invoke("todo/toggle", { id }),
  updateTodo: (id, title) => ipcRenderer.invoke("todo/update", { id, title }),
  deleteTodo: (id) => ipcRenderer.invoke("todo/delete", { id }),

  // Image Viewer
  openImageViewer: (src, alt) =>
    ipcRenderer.invoke("image-viewer/open", { src, alt }),
  onImageData: (callback) =>
    ipcRenderer.on("image-data", (_event, data) => callback(data)),

  // System Info
  getSystemInfo: () => ipcRenderer.invoke("system/info"),
  refreshSystemInfo: () => ipcRenderer.invoke("system/refresh"),
});
