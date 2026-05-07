import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

function formatDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeTimestamp(rawTimestamp) {
  const parsed = Number(rawTimestamp);
  if (Number.isNaN(parsed)) {
    return null;
  }

  if (parsed > 1e12) {
    return parsed;
  }

  if (parsed > 1e9) {
    return parsed * 1000;
  }

  return null;
}

function parseDatetime(rawDatetime) {
  if (!rawDatetime.includes("T")) {
    return new Date(rawDatetime.replace(" ", "T"));
  }

  return new Date(rawDatetime);
}

export default function TimeView() {
  const [now, setNow] = useState(Date.now());
  const [inputTimestamp, setInputTimestamp] = useState("");
  const [convertedTime, setConvertedTime] = useState(null);
  const [timestampError, setTimestampError] = useState("");
  const [selectedDatetime, setSelectedDatetime] = useState(
    formatDate(new Date()),
  );
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [datetimeError, setDatetimeError] = useState("");
  const [copied, setCopied] = useState(null);
  const copiedTimerRef = useRef(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(copiedTimerRef.current);
    };
  }, []);

  function handleConvertTimestamp() {
    setTimestampError("");
    setConvertedTime(null);
    const raw = inputTimestamp.trim();
    if (!raw) {
      setTimestampError("请输入时间戳");
      return;
    }

    const ts = normalizeTimestamp(raw);
    if (ts === null) {
      if (Number.isNaN(Number(raw))) {
        setTimestampError("无效的时间戳");
      } else {
        setTimestampError("时间戳位数不对，请输入秒级或毫秒级时间戳");
      }
      return;
    }

    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) {
      setTimestampError("无效的时间戳");
      return;
    }

    setConvertedTime({
      seconds: Math.floor(d.getTime() / 1000),
      milliseconds: d.getTime(),
      formatted: formatDate(d),
      iso: d.toISOString(),
    });
  }

  function handleDatetimeInputChange(e) {
    setSelectedDatetime(e.target.value);
    setSelectedTimestamp(null);
    setDatetimeError("");
  }

  function handleConvertDatetime() {
    setDatetimeError("");
    const raw = selectedDatetime.trim();
    if (!raw) {
      setDatetimeError("请输入日期时间");
      return;
    }

    const d = parseDatetime(raw);
    if (Number.isNaN(d.getTime())) {
      setDatetimeError("无效的日期时间格式，请输入如 2024-05-01 12:00:00");
      return;
    }

    setSelectedTimestamp({
      seconds: Math.floor(d.getTime() / 1000),
      milliseconds: d.getTime(),
    });
  }

  async function copyToClipboard(text, id) {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(id);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="view-container time-shell-view">
      <div className="time-shell-workspace">
        <article className="time-shell-panel">
          <section className="time-shell-section">
            <div className="time-shell-section-head">
              <strong className="time-shell-section-title">当前时间</strong>
              <span className="time-shell-section-badge">实时更新</span>
            </div>
            <div className="time-shell-card">
              <div className="time-shell-row">
                <span className="time-shell-label">时间</span>
                <span className="time-shell-value">{formatDate(new Date(now))}</span>
              </div>
              <div className="time-shell-row">
                <span className="time-shell-label">时区</span>
                <span className="time-shell-value is-mono">{timezone}</span>
              </div>
              <div className="time-shell-row">
                <span className="time-shell-label">秒级时间戳</span>
                <div className="time-shell-copy-row">
                  <span className="time-shell-value is-mono">{Math.floor(now / 1000)}</span>
                  <button
                    className="time-shell-copy-btn"
                    onClick={() => copyToClipboard(Math.floor(now / 1000), "now-s")}
                    type="button"
                  >
                    {copied === "now-s" ? <Check size={12} /> : "复制"}
                  </button>
                </div>
              </div>
              <div className="time-shell-row">
                <span className="time-shell-label">毫秒级时间戳</span>
                <div className="time-shell-copy-row">
                  <span className="time-shell-value is-mono">{now}</span>
                  <button
                    className="time-shell-copy-btn"
                    onClick={() => copyToClipboard(now, "now-ms")}
                    type="button"
                  >
                    {copied === "now-ms" ? <Check size={12} /> : "复制"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="time-shell-section">
            <div className="time-shell-section-head">
              <strong className="time-shell-section-title">时间戳 → 时间</strong>
              <span className="time-shell-section-hint">支持秒/毫秒</span>
            </div>
            <div className="time-shell-card">
              <div className="time-shell-input-row">
                <input
                  className="time-shell-input"
                  type="text"
                  placeholder="输入秒级或毫秒级时间戳，如 1714000000"
                  value={inputTimestamp}
                  onChange={(e) => {
                    setInputTimestamp(e.target.value);
                    setTimestampError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleConvertTimestamp()}
                />
                <button
                  className="time-shell-action-btn"
                  onClick={handleConvertTimestamp}
                  type="button"
                >
                  转换
                </button>
              </div>
              {timestampError && <div className="time-shell-error">{timestampError}</div>}
              {convertedTime && (
                <div className="time-shell-result">
                  <div className="time-shell-row">
                    <span className="time-shell-label">本地时间</span>
                    <span className="time-shell-value">{convertedTime.formatted}</span>
                  </div>
                  <div className="time-shell-row">
                    <span className="time-shell-label">ISO 8601</span>
                    <div className="time-shell-copy-row">
                      <span className="time-shell-value is-mono is-small">
                        {convertedTime.iso}
                      </span>
                      <button
                        className="time-shell-copy-btn"
                        onClick={() => copyToClipboard(convertedTime.iso, "iso")}
                        type="button"
                      >
                        {copied === "iso" ? <Check size={12} /> : "复制"}
                      </button>
                    </div>
                  </div>
                  <div className="time-shell-row">
                    <span className="time-shell-label">秒级时间戳</span>
                    <div className="time-shell-copy-row">
                      <span className="time-shell-value is-mono">
                        {convertedTime.seconds}
                      </span>
                      <button
                        className="time-shell-copy-btn"
                        onClick={() => copyToClipboard(convertedTime.seconds, "conv-s")}
                        type="button"
                      >
                        {copied === "conv-s" ? <Check size={12} /> : "复制"}
                      </button>
                    </div>
                  </div>
                  <div className="time-shell-row">
                    <span className="time-shell-label">毫秒级时间戳</span>
                    <div className="time-shell-copy-row">
                      <span className="time-shell-value is-mono">
                        {convertedTime.milliseconds}
                      </span>
                      <button
                        className="time-shell-copy-btn"
                        onClick={() =>
                          copyToClipboard(convertedTime.milliseconds, "conv-ms")
                        }
                        type="button"
                      >
                        {copied === "conv-ms" ? <Check size={12} /> : "复制"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="time-shell-section">
            <div className="time-shell-section-head">
              <strong className="time-shell-section-title">时间 → 时间戳</strong>
              <span className="time-shell-section-hint">YYYY-MM-DD HH:mm:ss</span>
            </div>
            <div className="time-shell-card">
              <div className="time-shell-input-row">
                <input
                  className="time-shell-input"
                  type="text"
                  placeholder="输入日期时间，如 2024-05-01 12:00:00"
                  value={selectedDatetime}
                  onChange={handleDatetimeInputChange}
                  onKeyDown={(e) => e.key === "Enter" && handleConvertDatetime()}
                />
                <button
                  className="time-shell-action-btn"
                  onClick={handleConvertDatetime}
                  type="button"
                >
                  转换
                </button>
              </div>
              {datetimeError && <div className="time-shell-error">{datetimeError}</div>}
              {selectedTimestamp && (
                <div className="time-shell-result">
                  <div className="time-shell-row">
                    <span className="time-shell-label">秒级时间戳</span>
                    <div className="time-shell-copy-row">
                      <span className="time-shell-value is-mono">
                        {selectedTimestamp.seconds}
                      </span>
                      <button
                        className="time-shell-copy-btn"
                        onClick={() =>
                          copyToClipboard(selectedTimestamp.seconds, "sel-s")
                        }
                        type="button"
                      >
                        {copied === "sel-s" ? <Check size={12} /> : "复制"}
                      </button>
                    </div>
                  </div>
                  <div className="time-shell-row">
                    <span className="time-shell-label">毫秒级时间戳</span>
                    <div className="time-shell-copy-row">
                      <span className="time-shell-value is-mono">
                        {selectedTimestamp.milliseconds}
                      </span>
                      <button
                        className="time-shell-copy-btn"
                        onClick={() =>
                          copyToClipboard(selectedTimestamp.milliseconds, "sel-ms")
                        }
                        type="button"
                      >
                        {copied === "sel-ms" ? <Check size={12} /> : "复制"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
