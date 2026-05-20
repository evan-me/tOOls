import React from "react";
import { Copy, Star, Trash2 } from "lucide-react";
import {
  PREVIEW_MAX_LENGTH,
  formatClipboardTime,
  getClipboardDisplayTitle,
  isReusableItem,
  parseClipboardTags,
  truncateText,
} from "./clipboard-utils";

export default function ClipboardHistoryTimeline({
  groupedItems,
  selectedItemId,
  onSelectItem,
  onToggleFavorite,
  onCopy,
  onDelete,
  hasMore,
  isLoadingMore,
  onReachEnd,
}) {
  function handleScroll(event) {
    if (!hasMore || isLoadingMore || typeof onReachEnd !== "function") {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 160) {
      onReachEnd();
    }
  }

  if (groupedItems.length === 0) {
    return (
      <div className="empty-hint clipboard-shell-empty-inner">
        <p>没有找到匹配的记录</p>
        <p className="hint-text">尝试使用其他关键词搜索</p>
      </div>
    );
  }

  return (
    <div className="clipboard-shell-timeline" onScroll={handleScroll}>
      {groupedItems.map((group) => (
        <section key={group.date} className="clipboard-shell-group">
          <div className="clipboard-shell-group-head">
            <span className="clipboard-shell-group-date">{group.date}</span>
            <span className="clipboard-shell-group-count">{group.items.length} 条记录</span>
          </div>
          <div className="clipboard-shell-group-items">
            {group.items.map((item) => {
              const itemTags = parseClipboardTags(item.tags_json);
              const isFavorite = Number(item.is_favorite) === 1;

              return (
                <article
                  key={item.id}
                  className={[
                    "clipboard-shell-card",
                    isReusableItem(item) ? "is-reusable" : "",
                    selectedItemId === item.id ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelectItem(item)}
                >
                  <div className="clipboard-shell-card-head">
                    <div className="clipboard-shell-card-heading">
                      <strong className="clipboard-shell-card-title">
                        {getClipboardDisplayTitle(item)}
                      </strong>
                      <div className="clipboard-shell-card-pills">
                        {isFavorite && (
                          <span className="clipboard-shell-pill is-favorite">收藏</span>
                        )}
                      </div>
                    </div>
                    {itemTags.length > 0 && (
                      <div className="clipboard-shell-tags">
                        {itemTags.map((tag) => (
                          <span key={`${item.id}-${tag}`} className="clipboard-shell-tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="clipboard-shell-card-body">
                    <p className="clipboard-shell-card-text">
                      {truncateText(item.content || "", PREVIEW_MAX_LENGTH)}
                    </p>
                  </div>
                  <div className="clipboard-shell-card-footer">
                    <span className="clipboard-shell-card-meta">
                      <span className="clipboard-shell-card-time">
                        {formatClipboardTime(item.created_at)}
                      </span>
                      <span className="clipboard-shell-card-size">
                        {(item.content || "").length} 字符
                      </span>
                    </span>
                    <div
                      className="clipboard-shell-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="clipboard-shell-icon-btn"
                        title={isFavorite ? "取消收藏" : "加入收藏"}
                        onClick={() => onToggleFavorite(item)}
                      >
                        <Star size={14} />
                      </button>
                      <button
                        type="button"
                        className="clipboard-shell-icon-btn"
                        title="复制到剪贴板"
                        onClick={() => onCopy(item)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="clipboard-shell-icon-btn is-danger"
                        title="删除"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {(isLoadingMore || !hasMore) && (
        <div className="clipboard-shell-history-status">
          {isLoadingMore ? "继续加载中…" : "已加载全部记录"}
        </div>
      )}
    </div>
  );
}