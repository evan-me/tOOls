# Silent Performance Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app into a quiet background utility that stays lightweight when idle by deferring heavy windows and removing avoidable always-on rendering work.

**Architecture:** Move startup behavior behind a small pure policy module so the Electron main process can start in tray-first mode without eagerly creating renderers. Keep the feature set intact, but create the main window and Quick Sheet window only when the user explicitly opens them, and simplify the default renderer shell so visible windows do less continuous GPU work.

**Tech Stack:** Electron 26, React 18, Vite 5, Node.js built-in test runner

---

### Task 1: Lock startup policy with tests

**Files:**
- Create: `src/main/lib/runtime-policy.js`
- Create: `test/main/runtime-policy.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

function loadRuntimePolicyModule() {
  try {
    return require("../../src/main/lib/runtime-policy.js");
  } catch {
    return {};
  }
}

function requireRuntimePolicyExports() {
  const moduleExports = loadRuntimePolicyModule();
  assert.equal(
    typeof moduleExports.resolveRuntimePolicy,
    "function",
    "expected resolveRuntimePolicy to be implemented",
  );
  return moduleExports;
}

test("runtime policy starts packaged app in tray-first silent mode", () => {
  const { resolveRuntimePolicy } = requireRuntimePolicyExports();

  assert.deepEqual(
    resolveRuntimePolicy({ isPackaged: true, argv: [] }),
    {
      openMainWindowOnLaunch: false,
      preloadQuickSheetWindow: false,
    },
  );
});

test("runtime policy keeps development launches visible", () => {
  const { resolveRuntimePolicy } = requireRuntimePolicyExports();

  assert.deepEqual(
    resolveRuntimePolicy({ isPackaged: false, argv: [] }),
    {
      openMainWindowOnLaunch: true,
      preloadQuickSheetWindow: false,
    },
  );
});

test("runtime policy allows packaged window launch override", () => {
  const { resolveRuntimePolicy } = requireRuntimePolicyExports();

  assert.deepEqual(
    resolveRuntimePolicy({ isPackaged: true, argv: ["--show-window"] }),
    {
      openMainWindowOnLaunch: true,
      preloadQuickSheetWindow: false,
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "test/main/runtime-policy.test.js"`
Expected: FAIL with `expected resolveRuntimePolicy to be implemented`

- [ ] **Step 3: Write minimal implementation**

```js
function resolveRuntimePolicy({ isPackaged, argv = [] } = {}) {
  const normalizedArgv = Array.isArray(argv) ? argv : [];
  const openMainWindowOnLaunch =
    !isPackaged || normalizedArgv.includes("--show-window");

  return {
    openMainWindowOnLaunch,
    preloadQuickSheetWindow: false,
  };
}

module.exports = {
  resolveRuntimePolicy,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "test/main/runtime-policy.test.js"`
Expected: PASS

### Task 2: Make Electron startup tray-first and window-lazy

**Files:**
- Modify: `src/main/index.js`
- Test: `test/main/runtime-policy.test.js`

- [ ] **Step 1: Wire runtime policy into startup**

```js
const { resolveRuntimePolicy } = require("./lib/runtime-policy");
```

```js
const runtimePolicy = resolveRuntimePolicy({
  isPackaged: app.isPackaged,
  argv: process.argv.slice(1),
});
```

- [ ] **Step 2: Create tray without forcing the main window to exist**

```js
function createTray() {
  // existing icon handling...
  tray.on("double-click", () => {
    focusMainWindow();
  });
}
```

- [ ] **Step 3: Add lazy window creation helpers**

```js
function ensureMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  createWindow({ show: false });
  return mainWindow;
}

function ensureQuickSheetWindow() {
  if (quickSheetWindow && !quickSheetWindow.isDestroyed()) {
    return quickSheetWindow;
  }

  createQuickSheetWindow();
  return quickSheetWindow;
}
```

- [ ] **Step 4: Switch focus/toggle paths to the lazy helpers**

```js
function focusMainWindow() {
  focusWindow(ensureMainWindow());
}

function toggleQuickSheetWindow() {
  const targetWindow = ensureQuickSheetWindow();
  // existing show/hide logic...
}
```

- [ ] **Step 5: Apply silent startup behavior**

```js
app.whenReady().then(async () => {
  await loadDatabase();
  createTray();
  registerQuickSheetShortcut();
  startClipboardMonitor();
  startReminderMonitor();

  if (runtimePolicy.openMainWindowOnLaunch) {
    focusMainWindow();
  }
});
```

- [ ] **Step 6: Run the tests and build**

Run: `npm run test:main && npm run build`
Expected: PASS

### Task 3: Lower visible-window background rendering cost

**Files:**
- Modify: `src/renderer/App.jsx`
- Modify: `src/renderer/styles/foundation/layout.css`
- Modify: `src/renderer/styles/foundation/base.css`

- [ ] **Step 1: Mark the renderer as silent-ui**

```js
useEffect(() => {
  document.documentElement.classList.add("silent-ui");
  return () => {
    document.documentElement.classList.remove("silent-ui");
  };
}, []);
```

- [ ] **Step 2: Remove continuous ambient animations from the shell**

```css
.app-layout::before,
.app-layout::after {
    filter: blur(56px);
    opacity: 0.14;
}

.app-layout::before,
.app-layout::after,
.titlebar-drag::before {
    animation: none;
}
```

- [ ] **Step 3: Disable expensive blur glass in quiet mode**

```css
html.silent-ui .titlebar,
html.silent-ui .sidebar,
html.silent-ui .modal,
html.silent-ui .modal-overlay,
html.silent-ui .todo-shell-layout,
html.silent-ui .todo-shell-calendar-card,
html.silent-ui .todo-shell-add-form,
html.silent-ui .todo-shell-dialog,
html.silent-ui .markdown-shell-panel,
html.silent-ui .markdown-shell-card,
html.silent-ui .markdown-shell-editor-panel,
html.silent-ui .quick-sheet-shell,
html.silent-ui .image-viewer-shell {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
```

- [ ] **Step 4: Rebuild the renderer and verify the app still starts**

Run: `npm run build`
Expected: PASS

### Task 4: Measure and document the new quiet behavior

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document silent startup behavior**

```md
- 打包版默认以静默托盘模式启动，使用托盘双击或快捷键唤起界面
- 如需直接显示主窗口，可用 `--show-window`
```

- [ ] **Step 2: Re-run validation**

Run: `npm run test:main && npm run build`
Expected: PASS

- [ ] **Step 3: Capture runtime spot-check**

Run: launch `dist\win-unpacked\tOOls.exe`, wait 10-20 seconds, and confirm the app can stay resident without opening the main window.
Expected: tray-first startup, no eager renderer windows until the UI is explicitly opened
