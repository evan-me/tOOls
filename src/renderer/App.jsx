import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  Clock,
  X,
  Shrink,
  ListTodo,
  FileText,
  ChevronLeft,
  ChevronRight,
  Settings,
  Monitor,
} from "lucide-react";
import ClipboardView from "./views/ClipboardView";
import MarkdownWorkbenchView from "./views/MarkdownWorkbenchView";
import TimeView from "./views/TimeView";
import CompressView from "./views/CompressView";
import TodoWorkbenchView from "./views/TodoWorkbenchView";
import SystemInfoView from "./views/SystemInfoView";
import QuickSheetView from "./views/QuickSheetView";

const menus = [
  { id: "todo", label: "待办列表", icon: ListTodo, color: "#3b82f6" },
  { id: "clipboard", label: "复制历史", icon: ClipboardList, color: "#22c55e" },
  { id: "markdown", label: "Markdown", icon: FileText, color: "#f472b6" },
  { id: "time", label: "时间转换", icon: Clock, color: "#f59e0b" },
  { id: "compress", label: "图片压缩", icon: Shrink, color: "#f43f5e" },
  { id: "sysinfo", label: "系统信息", icon: Monitor, color: "#06b6d4" },
];

const DEFAULT_VISIBILITY = {
  todo: true,
  markdown: true,
  clipboard: true,
  time: false,
  compress: false,
  sysinfo: true,
};

function loadVisibility() {
  try {
    const raw = localStorage.getItem("menu_visibility");
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULT_VISIBILITY, ...saved };
    }
  } catch {}
  return { ...DEFAULT_VISIBILITY };
}

function saveVisibility(vis) {
  localStorage.setItem("menu_visibility", JSON.stringify(vis));
}

function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-drag">tOOls</div>
      <div className="titlebar-buttons">
        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={() => window.api.closeWindow()}
          title="关闭"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function SettingsModal({ visibility, onChange, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>功能设置</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p className="settings-hint">开启的功能会显示在左侧菜单中</p>
          {menus.map((menu) => {
            const Icon = menu.icon;
            const enabled = visibility[menu.id] !== false;
            return (
              <div
                key={menu.id}
                className={`settings-row ${enabled ? "is-on" : ""}`}
              >
                <Icon
                  size={18}
                  className="settings-row-icon"
                  style={{ color: enabled ? menu.color : undefined }}
                />
                <span className="settings-row-label">{menu.label}</span>
                <button
                  type="button"
                  className={`settings-toggle ${enabled ? "is-on" : ""}`}
                  onClick={() =>
                    onChange({ ...visibility, [menu.id]: !enabled })
                  }
                  title={enabled ? "点击关闭" : "点击开启"}
                  aria-pressed={enabled}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function App() {
  const isQuickSheetMode = window.location.hash === "#quick-sheet";
  const [activeMenu, setActiveMenu] = useState("todo");
  const [collapsed, setCollapsed] = useState(true);
  const [visibility, setVisibility] = useState(loadVisibility);
  const [showSettings, setShowSettings] = useState(false);
  const [todoNavigation, setTodoNavigation] = useState(null);

  const visibleMenus = menus.filter((m) => visibility[m.id] !== false);

  useEffect(() => {
    if (isQuickSheetMode) {
      return undefined;
    }

    if (!window.api || typeof window.api.onAppNavigate !== "function") {
      return undefined;
    }

    return window.api.onAppNavigate((payload) => {
      if (!payload || payload.menuId !== "todo") {
        return;
      }

      setActiveMenu("todo");
      setTodoNavigation({
        ...payload,
        nonce: Date.now(),
      });
    });
  }, [isQuickSheetMode]);

  useEffect(() => {
    let resizeTimer = null;
    const root = document.documentElement;

    const handleResize = () => {
      root.classList.add("is-resizing");

      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = window.setTimeout(() => {
        root.classList.remove("is-resizing");
        resizeTimer = null;
      }, 140);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimer) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }
      document.documentElement.classList.remove("is-resizing");
    };
  }, []);

  if (isQuickSheetMode) {
    return (
      <div className="app-layout quick-sheet-app">
        <QuickSheetView />
      </div>
    );
  }

  function handleVisibilityChange(newVis) {
    setVisibility(newVis);
    saveVisibility(newVis);
    if (newVis[activeMenu] === false) {
      const firstVisible = menus.find((m) => newVis[m.id] !== false);
      if (firstVisible) setActiveMenu(firstVisible.id);
    }
  }

  function renderView() {
    switch (activeMenu) {
      case "todo":
        return <TodoWorkbenchView navigationRequest={todoNavigation} />;
      case "markdown":
        return <MarkdownWorkbenchView />;
      case "clipboard":
        return <ClipboardView />;
      case "time":
        return <TimeView />;
      case "compress":
        return <CompressView />;
      case "sysinfo":
        return <SystemInfoView />;
      default:
        return <div style={{ padding: 24 }}>开发中…</div>;
    }
  }

  return (
    <div className="app-layout">
      <TitleBar />
      <div className="app-body">
        <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
          <nav className="sidebar-menu">
            {visibleMenus.map((menu) => {
              const Icon = menu.icon;
              const isActive = activeMenu === menu.id;
              return (
                <div
                  key={menu.id}
                  className={`menu-item ${isActive ? "active" : ""}`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `${menu.color}1f`,
                          borderColor: `${menu.color}4a`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 14px 28px -16px ${menu.color}55, 0 8px 22px -12px rgba(79,70,229,0.24)`,
                          color: menu.color,
                        }
                      : {}
                  }
                  onClick={() => setActiveMenu(menu.id)}
                  title={collapsed ? menu.label : undefined}
                >
                  <Icon
                    size={18}
                    className="menu-item-icon"
                    style={{
                      color: isActive ? menu.color : menu.color + "aa",
                    }}
                  />
                  {!collapsed && (
                    <span className="menu-item-label">{menu.label}</span>
                  )}
                </div>
              );
            })}
          </nav>
          <div
            className="sidebar-settings"
            onClick={() => setShowSettings(true)}
            title={collapsed ? "设置" : undefined}
          >
            <Settings
              size={18}
              className="menu-item-icon"
              style={{ color: "var(--ink-soft)" }}
            />
            {!collapsed && (
              <span className="menu-item-label" style={{ color: "var(--ink-soft)" }}>
                设置
              </span>
            )}
          </div>
          <div
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "展开" : "收起"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </div>
        </aside>
        <main className={`main-content main-content--${activeMenu}`}>{renderView()}</main>
      </div>
      {showSettings && (
        <SettingsModal
          visibility={visibility}
          onChange={handleVisibilityChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
