import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  FileImage,
  Download,
  Trash2,
  ArrowRight,
  Maximize2,
  Lock,
  Unlock,
} from "lucide-react";
import { openImageViewer } from "../components/ImageViewer";

const OUTPUT_FORMATS = [
  { value: "image/jpeg", label: "JPEG", ext: "jpg" },
  { value: "image/webp", label: "WebP", ext: "webp" },
  { value: "image/png", label: "PNG", ext: "png" },
];

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function formatReduction(original, compressed) {
  if (original === 0) return "0%";
  const pct = ((1 - compressed / original) * 100).toFixed(1);
  return pct > 0 ? `-${pct}%` : `+${Math.abs(pct)}%`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

function compressImage(img, options) {
  const { format, quality, maxWidth, maxHeight } = options;

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (maxWidth && width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (maxHeight && height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      format,
      format === "image/png" ? undefined : quality,
    );
  });
}

export default function CompressView() {
  const [originalFile, setOriginalFile] = useState(null);
  const [originalSrc, setOriginalSrc] = useState("");
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [compressedSrc, setCompressedSrc] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [format, setFormat] = useState("image/jpeg");
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const [scaleMode, setScaleMode] = useState("percent");
  const [scalePercent, setScalePercent] = useState(100);
  const [aspectLocked, setAspectLocked] = useState(true);

  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const timerRef = useRef(null);
  const compressIdRef = useRef(0);
  const blobUrlRef = useRef("");
  const originalDimsRef = useRef({ width: 0, height: 0 });

  const formatRef = useRef(format);
  const qualityRef = useRef(quality);
  const maxWidthRef = useRef(maxWidth);
  const maxHeightRef = useRef(maxHeight);
  const scaleModeRef = useRef(scaleMode);
  const scalePercentRef = useRef(scalePercent);
  formatRef.current = format;
  qualityRef.current = quality;
  maxWidthRef.current = maxWidth;
  maxHeightRef.current = maxHeight;
  scaleModeRef.current = scaleMode;
  scalePercentRef.current = scalePercent;

  const runCompress = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;
    const dims = originalDimsRef.current;
    let effectiveMaxWidth, effectiveMaxHeight;
    if (scaleModeRef.current === "percent" && dims.width && dims.height) {
      const pct = scalePercentRef.current / 100;
      effectiveMaxWidth = Math.round(dims.width * pct);
      effectiveMaxHeight = Math.round(dims.height * pct);
    } else {
      effectiveMaxWidth = maxWidthRef.current || undefined;
      effectiveMaxHeight = maxHeightRef.current || undefined;
    }
    const id = ++compressIdRef.current;
    setCompressing(true);
    setError("");
    try {
      const blob = await compressImage(img, {
        format: formatRef.current,
        quality: qualityRef.current,
        maxWidth: effectiveMaxWidth || undefined,
        maxHeight: effectiveMaxHeight || undefined,
      });
      if (id !== compressIdRef.current) return;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setCompressedBlob(blob);
      setCompressedSrc(url);
    } catch (err) {
      if (id !== compressIdRef.current) return;
      setError(err.message || "压缩失败");
    } finally {
      if (id !== compressIdRef.current) return;
      setCompressing(false);
    }
  }, []);

  useEffect(() => {
    if (!originalSrc) {
      imgRef.current = null;
      originalDimsRef.current = { width: 0, height: 0 };
      return;
    }
    let cancelled = false;
    loadImage(originalSrc)
      .then((img) => {
        if (!cancelled) {
          imgRef.current = img;
          originalDimsRef.current = {
            width: img.naturalWidth,
            height: img.naturalHeight,
          };
          runCompress();
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "图片加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [originalSrc, runCompress]);

  useEffect(() => {
    if (!imgRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runCompress();
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    format,
    quality,
    scaleMode,
    scalePercent,
    maxWidth,
    maxHeight,
    runCompress,
  ]);

  const handleFile = useCallback((file) => {
    setError("");
    setCompressedBlob(null);
    setCompressedSrc("");
    if (!file || !file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    setOriginalFile(file);
    const reader = new FileReader();
    reader.onload = () => setOriginalSrc(reader.result);
    reader.onerror = () => {
      setError("文件读取失败，请重新选择");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e) => handleFile(e.target.files?.[0]);

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], "clipboard-image.png", { type });
            handleFile(file);
            return;
          }
        }
      }
      setError("剪贴板中没有图片");
    } catch {
      setError("无法读取剪贴板");
    }
  }, [handleFile]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleCompress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    runCompress();
  }, [runCompress]);

  const handleDownload = useCallback(() => {
    if (!compressedBlob) return;
    const ext = OUTPUT_FORMATS.find((f) => f.value === format)?.ext || "jpg";
    const name = originalFile
      ? originalFile.name.replace(/\.[^.]+$/, `.${ext}`)
      : `compressed.${ext}`;
    const a = document.createElement("a");
    a.href = compressedSrc;
    a.download = name;
    a.click();
  }, [compressedBlob, compressedSrc, format, originalFile]);

  const handleClear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = "";
    }
    imgRef.current = null;
    originalDimsRef.current = { width: 0, height: 0 };
    setOriginalFile(null);
    setOriginalSrc("");
    setCompressedBlob(null);
    setCompressedSrc("");
    setFormat("image/jpeg");
    setQuality(0.8);
    setMaxWidth(0);
    setMaxHeight(0);
    setScaleMode("percent");
    setScalePercent(100);
    setAspectLocked(true);
    setError("");
  }, []);

  const originalSize = originalFile?.size || 0;
  const compressedSize = compressedBlob?.size || 0;
  const formatObj = OUTPUT_FORMATS.find((f) => f.value === format);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>
          <FileImage
            size={18}
            style={{ marginRight: 6, verticalAlign: "text-bottom" }}
          />
          图片压缩
        </h2>
      </div>

      {/* 输入区 */}
      <div className="time-section">
        <div className="time-section-header">
          <span className="time-section-label">选择图片</span>
        </div>
        <div className="time-card">
          <div
            className="compress-drop"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            {originalSrc ? (
              <img
                src={originalSrc}
                alt="原图"
                className="compress-drop-thumb"
              />
            ) : (
              <>
                <FileImage size={36} className="compress-drop-icon" />
                <p>点击选择 或 拖拽图片到此处</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
          </div>
          <div className="b64-actions">
            <button
              className="time-action-btn b64-btn-secondary"
              onClick={handlePaste}
            >
              📋 粘贴图片
            </button>
            {originalSrc && (
              <button
                className="time-action-btn b64-btn-secondary"
                onClick={handleClear}
              >
                <Trash2 size={14} /> 清空
              </button>
            )}
          </div>
          {originalFile && (
            <div className="compress-meta">
              <span>{originalFile.name}</span>
              <span>{formatSize(originalSize)}</span>
              <span>
                {originalFile.type.replace("image/", "").toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 压缩参数 */}
      {originalSrc && (
        <div className="time-section">
          <div className="time-section-header">
            <span className="time-section-label">压缩设置</span>
          </div>
          <div className="time-card">
            {/* 输出格式 */}
            <div className="compress-row">
              <span className="time-label">输出格式</span>
              <div className="compress-format-group">
                {OUTPUT_FORMATS.map((f) => (
                  <button
                    key={f.value}
                    className={`compress-format-btn ${format === f.value ? "active" : ""}`}
                    onClick={() => setFormat(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 质量 */}
            {format !== "image/png" && (
              <div className="compress-row">
                <span className="time-label">质量</span>
                <div className="compress-slider-row">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="compress-slider"
                  />
                  <span className="compress-slider-val">
                    {Math.round(quality * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* 尺寸模式切换 */}
            <div className="compress-row">
              <span className="time-label">
                <Maximize2
                  size={13}
                  style={{ verticalAlign: "middle", marginRight: 4 }}
                />
                尺寸
              </span>
              <div className="compress-format-group">
                <button
                  className={`compress-format-btn ${scaleMode === "percent" ? "active" : ""}`}
                  onClick={() => {
                    if (scaleMode === "pixel") {
                      const dims = originalDimsRef.current;
                      if (dims.width > 0 && maxWidth > 0) {
                        setScalePercent(
                          Math.min(
                            100,
                            Math.round((maxWidth / dims.width) * 100),
                          ),
                        );
                      }
                      setScaleMode("percent");
                    }
                  }}
                >
                  缩放比例
                </button>
                <button
                  className={`compress-format-btn ${scaleMode === "pixel" ? "active" : ""}`}
                  onClick={() => {
                    if (scaleMode === "percent") {
                      const dims = originalDimsRef.current;
                      if (dims.width > 0 && dims.height > 0) {
                        const pct = scalePercent / 100;
                        setMaxWidth(Math.round(dims.width * pct));
                        setMaxHeight(Math.round(dims.height * pct));
                      }
                      setScaleMode("pixel");
                    }
                  }}
                >
                  指定尺寸
                </button>
              </div>
            </div>

            {/* 缩放比例模式 */}
            {scaleMode === "percent" && (
              <div className="compress-row">
                <span className="time-label">缩放</span>
                <div className="compress-slider-row">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={scalePercent}
                    onChange={(e) => setScalePercent(Number(e.target.value))}
                    className="compress-slider"
                  />
                  <span className="compress-slider-val">{scalePercent}%</span>
                </div>
                {originalDimsRef.current.width > 0 && (
                  <div className="compress-dims-preview">
                    <span className="compress-dims-text">
                      {originalDimsRef.current.width} ×{" "}
                      {originalDimsRef.current.height}
                    </span>
                    <ArrowRight size={12} className="compress-arrow" />
                    <span className="compress-dims-text">
                      {Math.round(
                        (originalDimsRef.current.width * scalePercent) / 100,
                      )}{" "}
                      ×{" "}
                      {Math.round(
                        (originalDimsRef.current.height * scalePercent) / 100,
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 指定尺寸模式 */}
            {scaleMode === "pixel" && (
              <div className="compress-row">
                <span className="time-label">尺寸</span>
                <div className="compress-size-inputs">
                  <div className="compress-size-field">
                    <input
                      type="number"
                      className="time-input compress-size-input"
                      placeholder="宽度"
                      value={maxWidth || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setMaxWidth(val);
                        if (aspectLocked && val > 0) {
                          const dims = originalDimsRef.current;
                          if (dims.width > 0 && dims.height > 0) {
                            setMaxHeight(
                              Math.round(val / (dims.width / dims.height)),
                            );
                          }
                        }
                      }}
                    />
                    <span className="compress-size-unit">px</span>
                  </div>
                  <span className="compress-size-x">×</span>
                  <div className="compress-size-field">
                    <input
                      type="number"
                      className="time-input compress-size-input"
                      placeholder="高度"
                      value={maxHeight || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setMaxHeight(val);
                        if (aspectLocked && val > 0) {
                          const dims = originalDimsRef.current;
                          if (dims.width > 0 && dims.height > 0) {
                            setMaxWidth(
                              Math.round(val * (dims.width / dims.height)),
                            );
                          }
                        }
                      }}
                    />
                    <span className="compress-size-unit">px</span>
                  </div>
                  <button
                    className="time-copy-btn"
                    onClick={() => setAspectLocked(!aspectLocked)}
                    title={aspectLocked ? "解锁宽高比" : "锁定宽高比"}
                  >
                    {aspectLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  {(maxWidth > 0 || maxHeight > 0) && (
                    <button
                      className="time-copy-btn"
                      onClick={() => {
                        setMaxWidth(0);
                        setMaxHeight(0);
                      }}
                    >
                      重置
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 压缩按钮 */}
            <div className="compress-actions">
              <button
                className="time-action-btn"
                onClick={handleCompress}
                disabled={compressing}
              >
                {compressing ? "压缩中…" : "立即压缩"}
              </button>
            </div>
            {error && <div className="time-error">{error}</div>}
          </div>
        </div>
      )}

      {/* 结果 */}
      {compressedSrc && (
        <div className="time-section">
          <div className="time-section-header">
            <span className="time-section-label">压缩结果</span>
            <div className="compress-result-badges">
              <span className="card-chars">{formatSize(originalSize)}</span>
              <ArrowRight size={12} className="compress-arrow" />
              <span className="card-chars">{formatSize(compressedSize)}</span>
              <span
                className="compress-reduction"
                data-positive={originalSize > compressedSize}
              >
                {formatReduction(originalSize, compressedSize)}
              </span>
            </div>
          </div>
          <div className="time-card">
            {/* 对比预览 */}
            <div className="compress-compare">
              <div className="compress-compare-col">
                <div className="compress-compare-label">原图</div>
                <div className="compress-compare-img">
                  <img
                    src={originalSrc}
                    alt="原图"
                    onClick={() => openImageViewer(originalSrc, "原图")}
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
              <div className="compress-compare-col">
                <div className="compress-compare-label">压缩后</div>
                <div className="compress-compare-img">
                  <img
                    src={compressedSrc}
                    alt="压缩后"
                    onClick={() => openImageViewer(compressedSrc, "压缩后")}
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
            </div>
            <div className="b64-actions">
              <button className="time-action-btn" onClick={handleDownload}>
                <Download size={14} /> 下载
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
