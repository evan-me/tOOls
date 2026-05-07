import React from "react";
import { Copy, Pencil, Star, Tag, X } from "lucide-react";
import { formatClipboardTime, isReusableItem } from "./clipboard-utils";

export default function ClipboardItemModal({
  item,
  titleDraft,
  tagsDraft,
  onChangeTitleDraft,
  onChangeTagsDraft,
  onClose,
  onToggleFavorite,
  onSaveMetadata,
  onCopy,
}) {
  if (!item) {
    return null;
  }

  const reusable = isReusableItem(item);
  const content = item.content || "";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal clipboard-shell-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>复制内容详情</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="modal-meta clipboard-shell-modal-meta">
          <span>{formatClipboardTime(item.created_at)}</span>
          <span>{content.length} 字符</span>
          <span>{content.split("\n").length} 行</span>
        </div>
        <div className="modal-body">
          {reusable ? (
            <div className="clipboard-shell-editor">
              <label className="clipboard-shell-field">
                <span>标题</span>
                <input
                  type="text"
                  className="clipboard-shell-input"
                  value={titleDraft}
                  onChange={(event) => onChangeTitleDraft(event.target.value)}
                  placeholder="给这个知识块起个名字"
                />
              </label>
              <label className="clipboard-shell-field">
                <span>标签</span>
                <div className="clipboard-shell-field-with-icon">
                  <Tag size={13} />
                  <input
                    type="text"
                    className="clipboard-shell-input"
                    value={tagsDraft}
                    onChange={(event) => onChangeTagsDraft(event.target.value)}
                    placeholder="例如：回复, release, 常用"
                  />
                </div>
              </label>
            </div>
          ) : (
            <div className="clipboard-shell-modal-hint">
              <p>把这条历史加入收藏后，就可以编辑标题和标签。</p>
            </div>
          )}
          <pre className="modal-content clipboard-shell-modal-content">{content || "（空内容）"}</pre>
        </div>
        <div className="modal-footer">
          <button type="button" className="clipboard-shell-modal-btn" onClick={() => onToggleFavorite(item)}>
            <Star size={13} />
            {Number(item.is_favorite) === 1 ? "取消收藏" : "加入收藏"}
          </button>
          {reusable && (
            <button type="button" className="clipboard-shell-modal-btn is-accent" onClick={onSaveMetadata}>
              <Pencil size={13} />
              保存信息
            </button>
          )}
          <button type="button" className="btn-primary" onClick={() => onCopy(item)}>
            <Copy size={13} />
            复制
          </button>
        </div>
      </div>
    </div>
  );
}