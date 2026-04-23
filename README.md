# tOOls

Electron + React + Vite + SQLite 桌面应用

## 环境要求

- Node.js >= 18
- npm >= 9

## 安装依赖

```bash
npm install
```

## 启动开发模式

```bash
npm run dev
```

该命令会同时启动：
- Vite 开发服务器（`http://localhost:5173`），支持 React 热更新（HMR）
- Electron 窗口，加载 Vite 开发服务器的内容

修改 `src/renderer/` 下的文件（React/CSS）后，界面会自动刷新，无需重启。

修改 `src/main/` 或 `src/preload/` 下的文件后，需要关闭 Electron 窗口并重新运行 `npm run dev`。

## 打包为 Windows 安装程序

```bash
npm run build
```

会在 `dist/` 目录生成 NSIS 安装程序（exe）。

## 项目结构

```
src/
├── main/           # Electron 主进程
│   └── index.js    # 窗口管理、SQLite 操作、IPC 处理
├── preload/        # 预加载脚本
│   └── preload.js  # 通过 contextBridge 安全暴露 API
└── renderer/       # 前端（React + Vite）
    ├── index.html
    ├── main.jsx
    ├── App.jsx
    ├── style.css
    └── vite.config.js
```

## 技术栈

- **Electron** — 桌面应用框架
- **React 18** — UI 框架
- **Vite 5** — 开发服务器与构建工具
- **sql.js** — SQLite（WASM 实现，无需原生编译）
- **electron-builder** — 打包与分发

## 注意事项

- SQLite 数据库文件存储在系统用户数据目录（`app.sqlite`）
- 所有数据库操作在主进程完成，渲染进程通过 IPC 调用，不直接访问 Node API
- 预加载脚本仅暴露 `getItems` 和 `addItem` 两个方法，遵循最小权限原则