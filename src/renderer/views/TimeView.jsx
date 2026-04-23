import React, { useEffect, useState } from "react";
import { Clock, Check } from "lucide-react";

function formatDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function TimeView() {
  const [now, setNow] = useState(Date.now());
  const [inputTimestamp, setInputTimestamp] = useState("");
  const [convertedTime, setConvertedTime] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [selectedDatetime, setSelectedDatetime] = useState(
    formatDate(new Date()),
  );
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleConvertTimestamp() {
    setConvertError("");
    setConvertedTime(null);
    const raw = inputTimestamp.trim();
    if (!raw) {
      setConvertError("请输入时间戳");
      return;
    }
    let ts = Number(raw);
    if (isNaN(ts)) {
      setConvertError("无效的时间戳");
      return;
    }
    if (ts > 1e12) {
      // already milliseconds
    } else if (ts > 1e9) {
      ts = ts * 1000;
    } else {
      setConvertError("时间戳位数不对，请输入秒级或毫秒级时间戳");
      return;
    }
    const d = new Date(ts);
    if (isNaN(d.getTime())) {
      setConvertError("无效的时间戳");
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
  }

  function handleConvertDatetime() {
    setConvertError("");
    const raw = selectedDatetime.trim();
    if (!raw) {
      setConvertError("请输入日期时间");
      return;
    }
    let d;
    if (raw.includes("T")) {
      d = new Date(raw);
    } else {
      d = new Date(raw.replace(" ", "T"));
    }
    if (isNaN(d.getTime())) {
      setConvertError("无效的日期时间格式，请输入如 2024-05-01 12:00:00");
      return;
    }
    setSelectedTimestamp({
      seconds: Math.floor(d.getTime() / 1000),
      milliseconds: d.getTime(),
    });
  }

  async function copyToClipboard(text, id) {
    await navigator.clipboard.writeText(String(text));
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>
          <Clock
            size={18}
            style={{ verticalAlign: "middle", marginRight: 6 }}
          />{" "}
          时间转换
        </h2>
      </div>

      {/* 当前时间 */}
      <div className="time-section">
        <div className="time-section-header">
          <span className="time-section-label">当前时间</span>
          <span className="time-section-badge">实时更新</span>
        </div>
        <div className="time-card">
          <div className="time-row">
            <span className="time-label">时间</span>
            <span className="time-value">{formatDate(new Date(now))}</span>
          </div>
          <div className="time-row">
            <span className="time-label">秒级时间戳</span>
            <div className="time-copy-row">
              <span className="time-value mono">{Math.floor(now / 1000)}</span>
              <button
                className="time-copy-btn"
                onClick={() => copyToClipboard(Math.floor(now / 1000), "now-s")}
              >
                {copied === "now-s" ? <Check size={12} /> : "复制"}
              </button>
            </div>
          </div>
          <div className="time-row">
            <span className="time-label">毫秒级时间戳</span>
            <div className="time-copy-row">
              <span className="time-value mono">{now}</span>
              <button
                className="time-copy-btn"
                onClick={() => copyToClipboard(now, "now-ms")}
              >
                {copied === "now-ms" ? <Check size={12} /> : "复制"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 时间戳 → 时间 */}
      <div className="time-section">
        <div className="time-section-header">
          <span className="time-section-label">时间戳 → 时间</span>
        </div>
        <div className="time-card">
          <div className="time-input-row">
            <input
              className="time-input"
              type="text"
              placeholder="输入秒级或毫秒级时间戳，如 1714000000"
              value={inputTimestamp}
              onChange={(e) => setInputTimestamp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConvertTimestamp()}
            />
            <button
              className="time-action-btn"
              onClick={handleConvertTimestamp}
            >
              转换
            </button>
          </div>
          {convertError && <div className="time-error">{convertError}</div>}
          {convertedTime && (
            <div className="time-result">
              <div className="time-row">
                <span className="time-label">本地时间</span>
                <span className="time-value">{convertedTime.formatted}</span>
              </div>
              <div className="time-row">
                <span className="time-label">ISO 8601</span>
                <div className="time-copy-row">
                  <span className="time-value mono small">
                    {convertedTime.iso}
                  </span>
                  <button
                    className="time-copy-btn"
                    onClick={() => copyToClipboard(convertedTime.iso, "iso")}
                  >
                    {copied === "iso" ? <Check size={12} /> : "复制"}
                  </button>
                </div>
              </div>
              <div className="time-row">
                <span className="time-label">秒级时间戳</span>
                <div className="time-copy-row">
                  <span className="time-value mono">
                    {convertedTime.seconds}
                  </span>
                  <button
                    className="time-copy-btn"
                    onClick={() =>
                      copyToClipboard(convertedTime.seconds, "conv-s")
                    }
                  >
                    {copied === "conv-s" ? <Check size={12} /> : "复制"}
                  </button>
                </div>
              </div>
              <div className="time-row">
                <span className="time-label">毫秒级时间戳</span>
                <div className="time-copy-row">
                  <span className="time-value mono">
                    {convertedTime.milliseconds}
                  </span>
                  <button
                    className="time-copy-btn"
                    onClick={() =>
                      copyToClipboard(convertedTime.milliseconds, "conv-ms")
                    }
                  >
                    {copied === "conv-ms" ? <Check size={12} /> : "复制"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 时间 → 时间戳 */}
      <div className="time-section">
        <div className="time-section-header">
          <span className="time-section-label">时间 → 时间戳</span>
        </div>
        <div className="time-card">
          <div className="time-input-row">
            <input
              className="time-input"
              type="text"
              placeholder="输入日期时间，如 2024-05-01 12:00:00"
              value={selectedDatetime}
              onChange={handleDatetimeInputChange}
              onKeyDown={(e) => e.key === "Enter" && handleConvertDatetime()}
            />
            <button className="time-action-btn" onClick={handleConvertDatetime}>
              转换
            </button>
          </div>
          {selectedTimestamp && (
            <div className="time-result">
              <div className="time-row">
                <span className="time-label">秒级时间戳</span>
                <div className="time-copy-row">
                  <span className="time-value mono">
                    {selectedTimestamp.seconds}
                  </span>
                  <button
                    className="time-copy-btn"
                    onClick={() =>
                      copyToClipboard(selectedTimestamp.seconds, "sel-s")
                    }
                  >
                    {copied === "sel-s" ? <Check size={12} /> : "复制"}
                  </button>
                </div>
              </div>
              <div className="time-row">
                <span className="time-label">毫秒级时间戳</span>
                <div className="time-copy-row">
                  <span className="time-value mono">
                    {selectedTimestamp.milliseconds}
                  </span>
                  <button
                    className="time-copy-btn"
                    onClick={() =>
                      copyToClipboard(selectedTimestamp.milliseconds, "sel-ms")
                    }
                  >
                    {copied === "sel-ms" ? <Check size={12} /> : "复制"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
