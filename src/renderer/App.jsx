import React, { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  Clock,
  Image,
  X,
  Shrink,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Settings,
  Monitor,
} from "lucide-react";
import ClipboardView from "./views/ClipboardView";
import TimeView from "./views/TimeView";
import Base64ImageView from "./views/Base64ImageView";
import CompressView from "./views/CompressView";
import TodoView from "./views/TodoView";
import SystemInfoView from "./views/SystemInfoView";

const menus = [
  { id: "todo", label: "待办列表", icon: ListTodo, color: "#3b82f6" },
  { id: "clipboard", label: "复制历史", icon: ClipboardList, color: "#22c55e" },
  { id: "time", label: "时间转换", icon: Clock, color: "#f59e0b" },
  { id: "base64", label: "图像转换", icon: Image, color: "#8b5cf6" },
  { id: "compress", label: "图片压缩", icon: Shrink, color: "#f43f5e" },
  { id: "sysinfo", label: "系统信息", icon: Monitor, color: "#06b6d4" },
];

const DEFAULT_VISIBILITY = {
  todo: true,
  clipboard: true,
  time: false,
  base64: false,
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
          <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
            开启的功能会显示在左侧菜单中
          </p>
          {menus.map((menu) => {
            const Icon = menu.icon;
            const enabled = visibility[menu.id] !== false;
            return (
              <div
                key={menu.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <Icon
                  size={18}
                  style={{
                    color: enabled ? menu.color : "#ccc",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: enabled ? "#1a1a1a" : "#999",
                  }}
                >
                  {menu.label}
                </span>
                <button
                  onClick={() =>
                    onChange({ ...visibility, [menu.id]: !enabled })
                  }
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                    background: enabled ? menu.color : "#ddd",
                  }}
                  title={enabled ? "点击关闭" : "点击开启"}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: enabled ? 20 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "left 0.2s",
                    }}
                  />
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
  const [activeMenu, setActiveMenu] = useState("todo");
  const [collapsed, setCollapsed] = useState(true);
  const [visibility, setVisibility] = useState(loadVisibility);
  const [showSettings, setShowSettings] = useState(false);

  const visibleMenus = menus.filter((m) => visibility[m.id] !== false);

  const handleVisibilityChange = useCallback(
    (newVis) => {
      setVisibility(newVis);
      saveVisibility(newVis);
      if (newVis[activeMenu] === false) {
        const firstVisible = menus.find((m) => newVis[m.id] !== false);
        if (firstVisible) setActiveMenu(firstVisible.id);
      }
    },
    [activeMenu],
  );

  function renderView() {
    switch (activeMenu) {
      case "todo":
        return <TodoView />;
      case "clipboard":
        return <ClipboardView />;
      case "time":
        return <TimeView />;
      case "base64":
        return <Base64ImageView />;
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
                          backgroundColor: menu.color + "18",
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
              style={{ color: "#aaa" }}
            />
            {!collapsed && (
              <span className="menu-item-label" style={{ color: "#aaa" }}>
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
        <main className="main-content">{renderView()}</main>
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
