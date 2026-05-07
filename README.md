# tOOls

> 一款基于 Electron + React 的桌面效率工具箱，集剪贴板管理、Todo、Markdown 编辑、快速记录等多种功能于一体。

[![Release](https://img.shields.io/github/v/release/evan-me/tOOls?style=flat-square)](https://github.com/evan-me/tOOls/releases)
[![License](https://img.shields.io/github/license/evan-me/tOOls?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue?style=flat-square)](#下载)

---

## 功能特性

| 模块 | 说明 |
|------|------|
| 📋 **剪贴板历史** | 自动记录剪贴板内容，支持搜索、分类与时间线浏览 |
| ✅ **Todo 工作台** | 任务管理、优先级标记、截止日期与完成情况统计 |
| 📝 **Markdown 工作台** | 实时预览的 Markdown 编辑器，支持元数据管理 |
| 📎 **快速记录** | 便签式快速笔记，支持模板与标签 |
| 🗜️ **文件压缩** | 本地文件压缩/解压，支持多种格式 |
| 💻 **系统信息** | CPU / 内存 / 磁盘等系统状态概览 |
| 🕐 **时间工具** | 时区转换、倒计时、时间戳格式化 |

---

## 下载

前往 [Releases 页面](https://github.com/evan-me/tOOls/releases) 下载对应平台的安装包：

- **Windows** — `tOOls-Setup-x.x.x.exe`
- **macOS (Intel)** — `tOOls-x.x.x-x64.dmg`
- **macOS (Apple Silicon)** — `tOOls-x.x.x-arm64.dmg`

---

## 开发

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

同时启动 Vite 开发服务器（HMR）和 Electron 窗口。修改 `src/renderer/` 下的文件后界面自动刷新；修改 `src/main/` 或 `src/preload/` 后需重启 Electron。

### 构建

```bash
# 当前平台
npm run build

# 仅 Windows
npm run build:win

# 仅 macOS（需在 macOS 机器上运行）
npm run build:mac
```

产物输出到 `dist/` 目录。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | [Electron 26](https://www.electronjs.org/) |
| 前端 | [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/) |
| 数据库 | [sql.js](https://sql.js.org/)（SQLite WASM，无需原生编译）|
| 图标 | [Lucide React](https://lucide.dev/) |
| 打包 | [electron-builder](https://www.electron.build/) |
| CI/CD | GitHub Actions |

---

## 项目结构

```
src/
├── main/                  # Electron 主进程
│   ├── index.js           # 窗口管理、IPC、SQLite
│   └── lib/               # 业务规则（剪贴板/Markdown/提醒等）
├── preload/
│   └── preload.js         # contextBridge 安全 API 暴露
└── renderer/              # React 前端
    ├── App.jsx            # 路由与导航
    ├── components/        # 可复用组件
    ├── views/             # 各功能视图
    └── styles/            # CSS 分层（foundation / components / views）

.github/workflows/
└── release.yml            # 自动构建 & 发布 workflow
```

---

## 架构说明

- 所有数据库操作在**主进程**完成，渲染进程通过 IPC 调用，不直接访问 Node API
- Preload 脚本通过 `contextBridge` 按功能分组暴露 API，遵循最小权限原则
- SQLite 数据库文件存储于系统用户数据目录（`userData/app.sqlite`）
- CSS 采用 Token 驱动设计，所有颜色/间距/动画时长集中定义于 `base.css`

---

## License

[MIT](LICENSE)
