import React, { useState, useEffect, useCallback } from "react";
import { Wifi, RefreshCw, Check } from "lucide-react";

export default function SystemInfoView() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadInfo = useCallback(async () => {
    const data = await window.api.getSystemInfo();
    setInfo(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  async function handleRefresh() {
    setRefreshing(true);
    const data = await window.api.refreshSystemInfo();
    setInfo(data);
    setRefreshing(false);
  }

  function handleCopy(ip, name) {
    window.api.copyToSystem(ip);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  }

  function formatTime(ts) {
    if (!ts) return "--";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  if (loading) {
    return (
      <div className="view-container">
        <p>加载中…</p>
      </div>
    );
  }

  const interfaces = info?.interfaces || [];

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>
          <Wifi size={20} style={{ verticalAlign: "middle", marginRight: 6 }} />
          IPv4 地址
        </h2>
        <button
          className="btn-primary"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw
            size={13}
            style={{
              verticalAlign: "middle",
              marginRight: 4,
              animation: refreshing ? "spin 1s linear infinite" : "none",
            }}
          />
          {refreshing ? "刷新中…" : "刷新"}
        </button>
      </div>

      {interfaces.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "#999",
            fontSize: 14,
          }}
        >
          未检测到 IPv4 地址
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          {interfaces.map((item) => {
            const isCopied = copied === item.name;
            return (
              <div
                key={item.name}
                style={{
                  background: "#fff",
                  border: `1px solid ${isCopied ? "#22c55e" : "#eaeaea"}`,
                  borderRadius: 12,
                  padding: "16px 18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  cursor: "pointer",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onClick={() => handleCopy(item.ip, item.name)}
                title="点击复制"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <Wifi
                    size={14}
                    style={{
                      color: isCopied ? "#22c55e" : "#3b82f6",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: "#999",
                      fontWeight: 500,
                    }}
                  >
                    {item.name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: "#1a1a1a",
                    fontWeight: 600,
                    fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
                    lineHeight: 1.4,
                  }}
                >
                  {isCopied ? (
                    <span style={{ color: "#22c55e", fontSize: 14 }}>
                      <Check
                        size={14}
                        style={{
                          verticalAlign: "middle",
                          marginRight: 4,
                        }}
                      />
                      已复制
                    </span>
                  ) : (
                    item.ip
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: 20,
          fontSize: 12,
          color: "#bbb",
          textAlign: "center",
        }}
      >
        上次更新: {formatTime(info?.updated_at)}
        {" · "}每 10 分钟自动刷新
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
