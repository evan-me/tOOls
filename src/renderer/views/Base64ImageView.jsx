import React, { useState, useRef, useCallback } from "react";
import {
  Image,
  ClipboardPaste,
  FolderOpen,
  Copy,
  Download,
  Check,
  FileImage,
} from "lucide-react";
import { openImageViewer } from "../components/ImageViewer";

const MIME_MAP = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

function detectMime(str) {
  // 已经是 data URL
  if (str.startsWith("data:")) {
    const match = str.match(/^data:([^;,]+)/);
    if (match) return { dataUrl: str, mime: match[1] };
  }
  // 尝试检测 magic bytes
  const header = str.slice(0, 20);
  if (header.startsWith("iVBORw0KGgo")) return { mime: "image/png" };
  if (header.startsWith("/9j/")) return { mime: "image/jpeg" };
  if (header.startsWith("R0lGOD")) return { mime: "image/gif" };
  if (header.startsWith("UklGR")) return { mime: "image/webp" };
  if (header.startsWith("AAABAA")) return { mime: "image/x-icon" };
  if (header.startsWith("Qk")) return { mime: "image/bmp" };
  // 默认 png
  return { mime: "image/png" };
}

export default function Base64ImageView() {
  const [input, setInput] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [imageInfo, setImageInfo] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);

  const decodeBase64 = useCallback((raw) => {
    setError("");
    setImageSrc("");
    setImageInfo(null);

    const str = raw.trim();
    if (!str) {
      setError("请输入 Base64 字符串");
      return;
    }

    // 如果已经是完整 data URL
    if (str.startsWith("data:image")) {
      setImageSrc(str);
      const match = str.match(/^data:([^;,]+)/);
      const mime = match ? match[1] : "unknown";
      // 估算原始大小
      const base64Part = str.split(",")[1] || "";
      const sizeBytes = Math.floor((base64Part.length * 3) / 4);
      setImageInfo({ mime, size: sizeBytes });
      return;
    }

    // 纯 base64 字符串
    const clean = str.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=\s]+$/.test(clean)) {
      setError("输入的字符串不是有效的 Base64 编码");
      return;
    }

    const { mime } = detectMime(clean);
    const dataUrl = `data:${mime};base64,${clean}`;

    // 验证是否能正常解码
    const img = new Image();
    img.onload = () => {
      setImageSrc(dataUrl);
      const sizeBytes = Math.floor((clean.length * 3) / 4);
      setImageInfo({ mime, size: sizeBytes });
    };
    img.onerror = () => {
      setError("Base64 解码后无法生成有效图像，请检查输入是否正确");
    };
    img.src = dataUrl;
  }, []);

  function handleDecode() {
    decodeBase64(input);
  }

  function handleClear() {
    setInput("");
    setImageSrc("");
    setImageInfo(null);
    setError("");
  }

  function handlePaste() {
    navigator.clipboard
      .readText()
      .then((text) => {
        setInput(text);
        decodeBase64(text);
      })
      .catch(() => {
        setError("无法读取剪贴板，请手动粘贴");
      });
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const text = e.dataTransfer.getData("text");
    if (text) {
      setInput(text);
      decodeBase64(text);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleCopyDataUrl() {
    if (!imageSrc) return;
    await navigator.clipboard.writeText(imageSrc);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownload() {
    if (!imageSrc) return;
    const a = document.createElement("a");
    a.href = imageSrc;
    a.download = `base64-image.${imageInfo?.mime?.split("/")[1] || "png"}`;
    a.click();
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setInput(dataUrl);
      decodeBase64(dataUrl);
    };
    reader.onerror = () => {
      setError("文件读取失败，请重新选择");
    };
    reader.readAsDataURL(file);
    // 重置 input value，允许重复选择同一文件
    e.target.value = "";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatMime(mime) {
    const map = {
      "image/png": "PNG",
      "image/jpeg": "JPEG",
      "image/gif": "GIF",
      "image/webp": "WebP",
      "image/svg+xml": "SVG",
      "image/bmp": "BMP",
      "image/x-icon": "ICO",
    };
    return map[mime] || mime;
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>
          <FileImage
            size={18}
            style={{ marginRight: 6, verticalAlign: "text-bottom" }}
          />
          Base64 图像查看器
        </h2>
      </div>

      {/* 输入区 */}
      <div className="time-section">
        <div className="time-section-header">
          <span className="time-section-label">Base64 输入</span>
        </div>
        <div className="time-card">
          <textarea
            className="b64-textarea"
            placeholder={
              "粘贴 Base64 字符串、data URL，或拖拽图片到此区域\n支持格式如：\n  data:image/png;base64,iVBOR...\n  /9j/4AAQSkZJRg..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            rows={5}
          />
          <div className="b64-actions">
            <button className="time-action-btn" onClick={handleDecode}>
              解码查看
            </button>
            <button
              className="time-action-btn b64-btn-secondary"
              onClick={handlePaste}
            >
              <ClipboardPaste size={14} /> 粘贴
            </button>
            <button
              className="time-action-btn b64-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen size={14} /> 选择图片
            </button>
            <button
              className="time-action-btn b64-btn-secondary"
              onClick={handleClear}
            >
              清空
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>
          {error && <div className="time-error">{error}</div>}
        </div>
      </div>

      {/* 预览区 */}
      {imageSrc && (
        <div className="time-section">
          <div className="time-section-header">
            <span className="time-section-label">图像预览</span>
            {imageInfo && (
              <div className="b64-info-row">
                <span className="card-chars">{formatMime(imageInfo.mime)}</span>
                <span className="card-chars">{formatSize(imageInfo.size)}</span>
              </div>
            )}
          </div>
          <div className="time-card">
            <div className="b64-preview">
              <img
                src={imageSrc}
                alt="Base64"
                className="b64-image"
                draggable={false}
                onClick={() => openImageViewer(imageSrc, "Base64 图片")}
                style={{ cursor: "pointer" }}
              />
            </div>
            <div className="b64-actions">
              <button className="time-action-btn" onClick={handleCopyDataUrl}>
                {copied ? (
                  <>
                    <Check size={14} /> 已复制
                  </>
                ) : (
                  <>
                    <Copy size={14} /> 复制 Data URL
                  </>
                )}
              </button>
              <button
                className="time-action-btn b64-btn-secondary"
                onClick={handleDownload}
              >
                <Download size={14} /> 下载图片
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
