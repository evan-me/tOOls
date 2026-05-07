import React, { useState, useEffect, useCallback, useRef } from "react";
import { Wifi, RefreshCw, Check } from "lucide-react";

export default function SystemInfoView() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [opTip, setOpTip] = useState("");
  const copiedTimerRef = useRef(null);
  const tipTimerRef = useRef(null);

  function showTip(text) {
    setOpTip(text);
    clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setOpTip(""), 1400);
  }

  const loadInfo = useCallback(async () => {
    setErrorMessage("");
    try {
      const data = await window.api.getSystemInfo();
      setInfo(data);
    } catch (error) {
      console.error("[SystemInfo] Failed to load system info", error);
      setInfo({ interfaces: [], updated_at: null });
      setErrorMessage("加载系统信息失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    return () => {
      clearTimeout(copiedTimerRef.current);
      clearTimeout(tipTimerRef.current);
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setErrorMessage("");
    setCopiedKey("");
    try {
      const data = await window.api.refreshSystemInfo();
      setInfo(data);
      showTip("系统信息已刷新");
    } catch (error) {
      console.error("[SystemInfo] Failed to refresh system info", error);
      setErrorMessage("刷新失败，请稍后重试");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCopy(ip, name) {
    setErrorMessage("");
    try {
      await window.api.copyToSystem(ip);
      const key = `${name}-${ip}`;
      setCopiedKey(key);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedKey(""), 1600);
      showTip(`已复制 ${name} 的 IP`);
    } catch (error) {
      console.error("[SystemInfo] Failed to copy IP", error);
      setErrorMessage("复制失败，请重试");
    }
  }

  function formatDateTime(ts) {
    if (!ts) return "--";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function formatClock(ts) {
    if (!ts) return "--";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  if (loading) {
    return (
      <div className="view-container system-shell-view">
        <section className="system-shell-loading">加载中…</section>
      </div>
    );
  }

  const interfaces = info?.interfaces || [];
  const updatedAt = info?.updated_at;

  return (
    <div className="view-container system-shell-view">
      <section className="system-shell-hero">
        <div className="system-shell-hero-copy">
          <h2 className="system-shell-title">
            <Wifi size={18} className="system-shell-title-icon" />
            <span>IPv4 地址</span>
          </h2>
          <p className="system-shell-subtitle">
            刷新网络信息并点击网卡卡片复制 IP，优先保留已实现页面能力。
          </p>
        </div>
        <div className="system-shell-hero-actions">
          <button
            className="system-shell-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? "正在刷新系统信息" : "刷新系统信息"}
            type="button"
          >
            <RefreshCw
              size={13}
              className={`system-shell-refresh-icon ${refreshing ? "is-spinning" : ""}`}
            />
            {refreshing ? "刷新中…" : "刷新"}
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="system-shell-error" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      )}

      <section className="system-shell-workspace">
        <article className="system-shell-panel system-shell-main-panel">
          <div
            className="system-shell-op-tip"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {opTip}
          </div>

          {interfaces.length === 0 ? (
            <div className="empty-hint system-shell-empty">
              <p>未检测到 IPv4 地址</p>
            </div>
          ) : (
            <div className="system-shell-grid">
              {interfaces.map((item) => {
                const key = `${item.name}-${item.ip}`;
                const isCopied = copiedKey === key;
                return (
                  <button
                    key={key}
                    className={`system-shell-card ${isCopied ? "is-copied" : ""}`}
                    onClick={() => handleCopy(item.ip, item.name)}
                    aria-label={`复制 ${item.name} 的 IP 地址 ${item.ip}`}
                    type="button"
                  >
                    <div className="system-shell-card-head">
                      <Wifi
                        size={14}
                        className={`system-shell-card-icon ${isCopied ? "is-copied" : ""}`}
                      />
                      <span className="system-shell-card-name">{item.name}</span>
                    </div>
                    <div className="system-shell-card-value">
                      {isCopied ? (
                        <span className="system-shell-copied">
                          <Check size={14} className="system-shell-copied-icon" />
                          已复制
                        </span>
                      ) : (
                        item.ip
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="system-shell-footnote">上次更新: {formatDateTime(updatedAt)}</div>
        </article>

        <aside className="system-shell-panel system-shell-side-panel">
          <div className="system-shell-section-head">
            <strong>网络概览</strong>
            <span>System</span>
          </div>

          <div className="system-shell-kpi-grid">
            <section className="system-shell-kpi-card">
              <div>活跃网卡</div>
              <strong>{interfaces.length}</strong>
            </section>
            <section className="system-shell-kpi-card">
              <div>最近刷新</div>
              <strong className="system-shell-mono">{formatClock(updatedAt)}</strong>
            </section>
          </div>

          <div className="system-shell-section-head system-shell-section-head-spaced">
            <strong>行为说明</strong>
            <span>UX</span>
          </div>
          <section className="system-shell-note-card">
            点击任意网卡卡片即复制 IP；点击刷新按钮可重新拉取接口数据并更新时间戳。
          </section>
        </aside>
      </section>
    </div>
  );
}
