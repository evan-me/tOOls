import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, X } from "lucide-react";

const FALLBACK_MODEL = {
  recentReusableItems: [],
};
const MAX_TODO_TITLE_LENGTH = 500;
const MAX_RECENT_COPY_ITEMS = 3;

function getDisplayTitle(item) {
  const explicitTitle = (item?.title || "").trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const fallbackContent = (item?.content || "").replace(/\s+/g, " ").trim();
  if (!fallbackContent) {
    return "空模板";
  }

  if (fallbackContent.length <= 28) {
    return fallbackContent;
  }

  return `${fallbackContent.slice(0, 28)}…`;
}

function getDisplayExcerpt(content) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "空内容";
  }

  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 72)}…`;
}

export default function QuickSheetView() {
  const hasQuickSheetApi =
    typeof window !== "undefined" &&
    window.api &&
    typeof window.api.getQuickSheetModel === "function" &&
    typeof window.api.runQuickSheetAction === "function";
  const [model, setModel] = useState(FALLBACK_MODEL);
  const [loading, setLoading] = useState(true);
  const [todoTitle, setTodoTitle] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);
  const statusTimerRef = useRef(null);

  const loadModel = useCallback(async () => {
    if (!hasQuickSheetApi) {
      setModel(FALLBACK_MODEL);
      setLoading(false);
      return;
    }

    try {
      const nextModel = await window.api.getQuickSheetModel();
      setModel({
        recentReusableItems: Array.isArray(nextModel?.recentReusableItems)
          ? nextModel.recentReusableItems
          : [],
      });
      setErrorMessage("");
    } catch (error) {
      console.error("[QuickSheet] Failed to load model", error);
      setErrorMessage("Quick Sheet 数据加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [hasQuickSheetApi]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  useEffect(() => {
    if (!hasQuickSheetApi || !window.api.onQuickSheetRefresh) {
      return undefined;
    }

    return window.api.onQuickSheetRefresh(() => {
      loadModel();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });
  }, [hasQuickSheetApi, loadModel]);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && window.api?.closeWindow) {
        window.api.closeWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(statusTimerRef.current);
    };
  }, []);

  const reusableItems = useMemo(
    () => (model.recentReusableItems || []).slice(0, MAX_RECENT_COPY_ITEMS),
    [model.recentReusableItems],
  );

  function showStatus(message) {
    setStatusMessage(message);
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(""), 1800);
  }

  async function runAction(payload, successMessage) {
    if (!hasQuickSheetApi) {
      setErrorMessage("Quick Sheet 需要在 Electron 应用中运行。");
      return null;
    }

    try {
      const result = await window.api.runQuickSheetAction(payload);
      setErrorMessage("");
      if (successMessage) {
        showStatus(successMessage);
      }
      return result;
    } catch (error) {
      console.error("[QuickSheet] Action failed", error);
      setErrorMessage("Quick Sheet 操作失败，请稍后重试。");
      return null;
    }
  }

  async function handleCreateTodo(event) {
    event.preventDefault();
    const trimmedTitle = todoTitle.trim();
    if (!trimmedTitle) {
      setErrorMessage("请输入待办标题。");
      return;
    }

    if (trimmedTitle.length > MAX_TODO_TITLE_LENGTH) {
      setErrorMessage("待办标题不能超过 500 个字符。");
      return;
    }

    const result = await runAction(
      { type: "create-todo", title: trimmedTitle, listId: null },
      "待办已创建",
    );
    if (!result) {
      return;
    }

    setTodoTitle("");
  }

  function handleCopyItem(item) {
    return runAction(
      { type: "copy-clipboard-item", itemId: item.id },
      "内容已复制",
    );
  }

  return (
    <div className="quick-sheet-view">
      <section className="quick-sheet-panel">
        <header className="quick-sheet-toolbar">
          <strong className="quick-sheet-title">Quick Sheet</strong>
          <button
            type="button"
            className="quick-sheet-close"
            onClick={() => window.api?.closeWindow?.()}
            aria-label="关闭 Quick Sheet"
          >
            <X size={14} />
          </button>
        </header>

        {statusMessage && <div className="quick-sheet-status">{statusMessage}</div>}
        {errorMessage && <div className="quick-sheet-error">{errorMessage}</div>}

        <div className="quick-sheet-grid">
          <form className="quick-sheet-todo-form" onSubmit={handleCreateTodo}>
            <div className="quick-sheet-section-head">
              <strong>快速创建待办</strong>
            </div>
            <div className="quick-sheet-todo-row">
              <input
                ref={inputRef}
                type="text"
                className="quick-sheet-input"
                placeholder="例如：补一封跟进邮件"
                maxLength={MAX_TODO_TITLE_LENGTH}
                value={todoTitle}
                onChange={(event) => setTodoTitle(event.target.value)}
              />
              <button type="submit" className="quick-sheet-primary-btn">
                创建
              </button>
            </div>
          </form>

          <section className="quick-sheet-reusable-section">
            <div className="quick-sheet-section-head">
              <strong>最近复制</strong>
              <span>{reusableItems.length}/{MAX_RECENT_COPY_ITEMS}</span>
            </div>

            {loading ? (
              <div className="quick-sheet-empty">载入中…</div>
            ) : reusableItems.length === 0 ? (
              <div className="quick-sheet-empty">还没有可复用记录。</div>
            ) : (
              <div className="quick-sheet-reusable-list">
                {reusableItems.map((item) => {
                  const displayTitle = getDisplayTitle(item);

                  return (
                    <article key={item.id} className="quick-sheet-reusable-card">
                      <div className="quick-sheet-reusable-row">
                        <div className="quick-sheet-reusable-body">
                          <strong className="quick-sheet-reusable-title">
                            {displayTitle}
                          </strong>
                          <p className="quick-sheet-reusable-text">
                            {getDisplayExcerpt(item.content)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="quick-sheet-copy-btn"
                          onClick={() => handleCopyItem(item)}
                          aria-label={`快速复制 ${displayTitle}`}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
