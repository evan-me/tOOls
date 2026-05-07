# tOOls

一款基于 Electron + React 的桌面效率工具箱。

## 功能

- 📋 **剪贴板历史** — 自动记录、搜索、分类与时间线浏览
- ✅ **Todo 工作台** — 任务管理、优先级、截止日期与统计
- 📝 **Markdown 工作台** — 实时预览编辑器，支持元数据
- 📎 **快速记录** — 便签式笔记，支持模板与标签
- 🗜️ **文件压缩** — 本地压缩/解压，支持多种格式
- 💻 **系统信息** — CPU / 内存 / 磁盘等状态概览
- 🕐 **时间工具** — 时区转换、倒计时、时间戳格式化

## 技术栈

- **桌面框架** — Electron 26
- **前端框架** — React 18 + Vite 5
- **数据库** — sql.js（SQLite WASM）
- **UI 图标** — Lucide React
- **打包工具** — electron-builder
- **CI/CD** — GitHub Actions

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发模式（Vite HMR + Electron）
npm run dev

# 构建（当前平台）
npm run build

# 仅 Windows
npm run build:win

# 仅 macOS（需在 macOS 上运行）
npm run build:mac
```

产物输出到 `dist/` 目录。

## 下载

前往 [Releases 页面](https://github.com/evan-me/tOOls/releases) 下载对应平台的安装包。

## macOS 首次使用

首次在 macOS 上运行 tOOls 时，系统可能会显示安全警告。按以下步骤信任该应用：

1. **尝试打开应用** — 出现安全警告弹窗时，**保持弹窗打开**，不要点击"好"或"取消"

2. **打开系统设置** — 进入 **隐私与安全性**

3. **允许应用** — 在"安全性"区域找到关于 **tOOls.app 被阻止** 的提示，点击旁边的 **"仍要打开"** 按钮

4. **输入密码** — 输入你的电脑密码确认授权

5. **完成** — 系统会将 tOOls 加入信任列表，之后可以正常启动

> 💡 **"仍要打开"按钮** 只在首次尝试打开被拦截的应用后的一小时内出现，建议尽快操作。

## License

MIT License 2.0 — 详见 [LICENSE](LICENSE) 文件。
