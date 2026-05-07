import React from "react";
import { Search, X } from "lucide-react";

export default function ClipboardSearchHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  plainHistoryCount,
  onClearAll,
  opTip,
}) {
  return (
    <>
      <div className="clipboard-shell-search-wrap">
        <Search size={14} className="clipboard-shell-search-icon" />
        <input
          type="text"
          className="clipboard-shell-search-input"
          placeholder="搜索复制内容…"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="clipboard-shell-search-clear"
            onClick={onClearSearch}
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className="clipboard-shell-search-actions">
        <span className="clipboard-shell-op-tip" aria-live="polite">
          {opTip}
        </span>
        {plainHistoryCount > 0 && (
          <button
            type="button"
            className="clipboard-shell-clear-inline"
            onClick={onClearAll}
          >
            清空历史
          </button>
        )}
      </div>
    </>
  );
}