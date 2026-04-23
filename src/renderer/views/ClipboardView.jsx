import React, { useEffect, useState, useCallback } from "react";
import { ClipboardList, Copy, Trash2, X } from "lucide-react";

export default function ClipboardView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const loadHistory = useCallback(async () => {
    const data = await window.api.getClipboardHistory();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    const timer = setInterval(loadHistory, 2000);
    return () => clearInterval(timer);
  }, [loadHistory]);

  async function handleCopy(item) {
    await window.api.copyToSystem(item.content);
  }

  async function handleDelete(id) {
    await window.api.deleteClipboardItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem(null);
    }
  }

  async function handleClearAll() {
    if (!confirm("确定清空所有复制记录？")) return;
    await window.api.clearClipboardHistory();
    setItems([]);
    setSelectedItem(null);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function truncate(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "…";
  }

  function groupItemsByDate(items) {
    const groups = {};
    items.forEach((item) => {
      const date = new Date(item.created_at);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(item);
    });
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedDates.map((date) => ({
      date,
      items: groups[date],
    }));
  }

  if (loading) {
    return (
      <div className="view-container">
        <p>加载中…</p>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>
          <ClipboardList
            size={20}
            style={{ verticalAlign: "middle", marginRight: 6 }}
          />
          复制历史
        </h2>
        {items.length > 0 && (
          <button className="btn-danger" onClick={handleClearAll}>
            清空全部
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-hint">
          <p>还没有复制记录</p>
          <p className="hint-text">在任意地方复制内容后，会自动出现在这里</p>
        </div>
      ) : (
        <div className="clipboard-timeline">
          {groupItemsByDate(items).map((group) => (
            <div key={group.date} className="timeline-group">
              <div className="timeline-date">
                <span className="timeline-date-text">{group.date}</span>
                <span className="timeline-count">
                  {group.items.length} 条记录
                </span>
              </div>
              <div className="timeline-items">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="clipboard-card"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="card-body">
                      <p className="card-text">{truncate(item.content, 120)}</p>
                    </div>
                    <div className="card-footer">
                      <span className="card-meta">
                        <span className="card-time">
                          {formatTime(item.created_at)}
                        </span>
                        <span className="card-chars">
                          {item.content.length} 字符
                        </span>
                      </span>
                      <div
                        className="card-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn-icon"
                          title="复制到剪贴板"
                          onClick={() => handleCopy(item)}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          title="删除"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>复制内容详情</h3>
              <button
                className="modal-close"
                onClick={() => setSelectedItem(null)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="modal-meta">
              <span>{formatTime(selectedItem.created_at)}</span>
              <span>{selectedItem.content.length} 字符</span>
              <span>{selectedItem.content.split("\n").length} 行</span>
            </div>
            <div className="modal-body">
              <pre className="modal-content">{selectedItem.content}</pre>
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => handleCopy(selectedItem)}
              >
                <Copy
                  size={13}
                  style={{ verticalAlign: "middle", marginRight: 4 }}
                />
                复制
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
