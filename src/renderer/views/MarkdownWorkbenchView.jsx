import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MarkedMarkdown from "marked-react";
import { Marked } from "marked";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Plus,
  Save,
  Tags,
} from "lucide-react";
import {
  buildCalendarMatrix,
  parseClipboardTags,
  parseTagInput,
  tagsToInputValue,
  tsToDateStr,
} from "../components/clipboard/clipboard-utils";

const SAFE_MARKDOWN_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function stripMarkedCheckboxTokens(tokens) {
  if (tokens == null) {
    return tokens;
  }

  if (!Array.isArray(tokens)) {
    return [];
  }

  return tokens
    .filter((token) => token?.type !== "checkbox")
    .map((token) => {
      if (!token || typeof token !== "object") {
        return token;
      }

      const nextToken = { ...token };

      if (Array.isArray(token.tokens)) {
        nextToken.tokens = stripMarkedCheckboxTokens(token.tokens);
      }

      if (Array.isArray(token.items)) {
        nextToken.items = token.items.map((item) => ({
          ...item,
          tokens: stripMarkedCheckboxTokens(item.tokens),
        }));
      }

      return nextToken;
    });
}

const MARKDOWN_PREVIEW_MARKED_INSTANCE = new Marked();
const markdownPreviewLexer = MARKDOWN_PREVIEW_MARKED_INSTANCE.lexer.bind(
  MARKDOWN_PREVIEW_MARKED_INSTANCE,
);

// marked-react already renders task list checkboxes from list item metadata.
// Removing only the redundant inline checkbox tokens avoids its parser warning
// without changing preview behavior for this isolated renderer instance.
MARKDOWN_PREVIEW_MARKED_INSTANCE.lexer = (markdownString, lexerOptions) => {
  const tokens = markdownPreviewLexer(markdownString, lexerOptions);

  try {
    return stripMarkedCheckboxTokens(tokens);
  } catch (error) {
    console.error("[MarkdownPreview] lexer normalization failed", error);
    return tokens;
  }
};

function normalizeMarkdownPreviewContent(content) {
  const normalizedContent = typeof content === "string" ? content : String(content ?? "");
  return normalizedContent.replace(/\u0000/g, "");
}

class MarkdownPreviewBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("[MarkdownPreview] render failed", error);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.content !== this.props.content) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="markdown-shell-preview-error" role="alert">
        <p>当前 Markdown 无法安全渲染，已回退为原始文本预览。</p>
        <p className="hint-text">请切回原始模式修正文档内容后重试。</p>
        <pre className="markdown-shell-preview-error-content">
          {normalizeMarkdownPreviewContent(this.props.content)}
        </pre>
      </div>
    );
  }
}

function createEmptyDraft() {
  return {
    id: null,
    title: "",
    content: "",
    tagsInput: "",
  };
}

function createDraftFromDocument(document) {
  return {
    id: document.id,
    title: document.title || "",
    content: document.content || "",
    tagsInput: tagsToInputValue(parseClipboardTags(document.tags_json)),
  };
}

function formatDocumentTime(timestamp) {
  if (!timestamp) {
    return "刚刚";
  }

  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDocumentTitle(document) {
  const explicitTitle = (document?.title || "").trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const firstContentLine = (document?.content || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);

  return firstContentLine || "未命名文档";
}

function getDocumentExcerpt(content) {
  const compact = (content || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "空白文档，适合直接粘贴 Markdown 草稿。";
  }

  if (compact.length <= 88) {
    return compact;
  }

  return `${compact.slice(0, 88)}…`;
}

function isDraftDirty(document, draft) {
  if (!document) {
    return Boolean(draft.title.trim() || draft.content.trim() || draft.tagsInput.trim());
  }

  const originalTags = tagsToInputValue(parseClipboardTags(document.tags_json));
  return (
    (document.title || "") !== draft.title ||
    (document.content || "") !== draft.content ||
    originalTags !== draft.tagsInput
  );
}

function getSafeMarkdownHref(href) {
  if (typeof href !== "string") {
    return null;
  }

  const trimmedHref = href.trim();
  if (!trimmedHref) {
    return null;
  }

  if (trimmedHref.startsWith("#")) {
    return trimmedHref;
  }

  try {
    const parsedUrl = new URL(trimmedHref);
    return SAFE_MARKDOWN_PROTOCOLS.has(parsedUrl.protocol) ? trimmedHref : null;
  } catch {
    return null;
  }
}

const MARKDOWN_PREVIEW_RENDERER = {
  link(href, text) {
    const safeHref = getSafeMarkdownHref(href);
    if (!safeHref) {
      return (
        <span key={this.elementId} className="markdown-shell-preview-blocked-link">
          {text}
        </span>
      );
    }

    return (
      <a key={this.elementId} href={safeHref} target="_blank" rel="noreferrer noopener">
        {text}
      </a>
    );
  },
  image() {
    return (
      <span key={this.elementId} className="markdown-shell-preview-blocked">
        图片预览已在当前版本禁用
      </span>
    );
  },
};

function MarkdownPreviewContent({ content }) {
  const previewContent = normalizeMarkdownPreviewContent(content);

  return (
    <div className="markdown-shell-preview-body">
      <MarkedMarkdown
        value={previewContent}
        gfm
        instance={MARKDOWN_PREVIEW_MARKED_INSTANCE}
        renderer={MARKDOWN_PREVIEW_RENDERER}
      />
    </div>
  );
}

export default function MarkdownWorkbenchView() {
  const [documents, setDocuments] = useState([]);
  const [draft, setDraft] = useState(createEmptyDraft);
  const [mode, setMode] = useState("raw");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [calendarDate, setCalendarDate] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
  const [selectedDate, setSelectedDate] = useState(null);
  const feedbackTimerRef = useRef(null);
  const draftRef = useRef(createEmptyDraft());

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === draft.id) || null,
    [documents, draft.id],
  );

  const publishFeedback = useCallback((type, text) => {
    clearTimeout(feedbackTimerRef.current);
    setFeedback({ type, text });
    if (!text) {
      return;
    }

    feedbackTimerRef.current = setTimeout(() => {
      setFeedback({ type: "", text: "" });
    }, 2400);
  }, []);

  const loadDocuments = useCallback(async (preferredDocument = null) => {
    try {
      const data = await window.api.getMarkdownDocuments();
      const nextDocuments = Array.isArray(data) ? data : [];
      setDocuments(nextDocuments);

      const nextSelectedDocument = preferredDocument
        ? nextDocuments.find((item) => item.id === preferredDocument.id) || preferredDocument
        : nextDocuments.find((item) => item.id === draftRef.current.id) || nextDocuments[0] || null;

      setDraft(nextSelectedDocument ? createDraftFromDocument(nextSelectedDocument) : createEmptyDraft());
      setFeedback((current) => (current.type === "error" ? current : { type: "", text: "" }));
    } catch (error) {
      console.error(error);
      publishFeedback("error", "加载 Markdown 文档失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [publishFeedback]);

  useEffect(() => {
    loadDocuments();

    return () => {
      clearTimeout(feedbackTimerRef.current);
    };
  }, [loadDocuments]);

  const datesWithData = useMemo(() => {
    const next = new Set();
    documents.forEach((item) => {
      if (item.updated_at) {
        next.add(tsToDateStr(item.updated_at));
      }
    });
    return next;
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (!selectedDate) {
      return documents;
    }

    return documents.filter((item) => tsToDateStr(item.updated_at) === selectedDate);
  }, [documents, selectedDate]);

  const calendarRows = useMemo(
    () => buildCalendarMatrix(calendarDate.year, calendarDate.month),
    [calendarDate.month, calendarDate.year],
  );

  const draftTags = useMemo(() => parseTagInput(draft.tagsInput), [draft.tagsInput]);
  const dirty = useMemo(() => isDraftDirty(selectedDocument, draft), [selectedDocument, draft]);

  const openDraft = useCallback((nextDocument) => {
    setDraft(nextDocument ? createDraftFromDocument(nextDocument) : createEmptyDraft());
    setMode("raw");
  }, []);

  const guardUnsavedChanges = useCallback(() => {
    if (!dirty) {
      return true;
    }

    return window.confirm("当前内容尚未保存，继续切换会丢失改动。确定继续吗？");
  }, [dirty]);

  const handleCreateNew = useCallback(() => {
    if (!guardUnsavedChanges()) {
      return;
    }

    openDraft(null);
    publishFeedback("", "");
  }, [guardUnsavedChanges, openDraft, publishFeedback]);

  const handleSelectDocument = useCallback((document) => {
    if (document.id === draft.id) {
      return;
    }

    if (!guardUnsavedChanges()) {
      return;
    }

    openDraft(document);
    publishFeedback("", "");
  }, [draft.id, guardUnsavedChanges, openDraft, publishFeedback]);

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const savedDocument = await window.api.saveMarkdownDocument({
        id: draft.id,
        title: draft.title,
        content: draft.content,
        tags: draftTags,
      });
      await loadDocuments(savedDocument);
      publishFeedback("success", draft.id ? "文档已更新" : "文档已保存");
    } catch (error) {
      console.error(error);
      publishFeedback("error", "保存失败，请稍后重试");
    } finally {
      setIsSaving(false);
    }
  }, [draft.id, draft.title, draft.content, draftTags, loadDocuments, publishFeedback]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isSaving) {
          void handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, isSaving]);

  function handlePreviousMonth() {
    setCalendarDate(({ year, month }) => {
      const next = new Date(year, month - 1, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function handleNextMonth() {
    setCalendarDate(({ year, month }) => {
      const next = new Date(year, month + 1, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  if (loading) {
    return (
      <div className="view-container markdown-shell-view">
        <div className="markdown-shell-loading">加载 Markdown 工作台中…</div>
      </div>
    );
  }

  return (
    <div className="view-container markdown-shell-view">
      {feedback.text && (
        <div className={`markdown-shell-feedback ${feedback.type === "error" ? "is-error" : ""}`}>
          {feedback.text}
        </div>
      )}

      <div className="markdown-shell-workspace">
        <section className="markdown-shell-panel markdown-shell-editor-panel">
          <div className="markdown-shell-header">
            <div className="markdown-shell-header-fields">
              <input
                className="markdown-shell-title-input"
                type="text"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="文档标题，可留空"
              />
              <label className="markdown-shell-tags-field">
                <Tags size={14} />
                <input
                  type="text"
                  value={draft.tagsInput}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, tagsInput: event.target.value }))
                  }
                  placeholder="标签，逗号分隔；不存在的会随保存直接创建"
                />
              </label>
            </div>

            <div className="markdown-shell-header-actions">
              <div className="markdown-shell-mode-switch" role="tablist" aria-label="Markdown 视图模式">
                <button
                  type="button"
                  className={`markdown-shell-mode-btn ${mode === "raw" ? "is-active" : ""}`}
                  onClick={() => setMode("raw")}
                >
                  <FileText size={14} />
                  原始
                </button>
                <button
                  type="button"
                  className={`markdown-shell-mode-btn ${mode === "preview" ? "is-active" : ""}`}
                  onClick={() => setMode("preview")}
                >
                  <Eye size={14} />
                  预览
                </button>
              </div>
              <button
                type="button"
                className="markdown-shell-save-btn"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                <Save size={14} />
                {isSaving ? "保存中" : dirty ? "保存" : "已同步"}
              </button>
            </div>
          </div>

          <div className="markdown-shell-editor-meta">
            <span>{draft.id ? `文档 #${draft.id}` : "新建草稿"}</span>
            <span>{draftTags.length > 0 ? `${draftTags.length} 个标签` : "未设置标签"}</span>
            <span>{dirty ? "有未保存修改" : "内容已同步"}</span>
          </div>

          {mode === "raw" ? (
            <textarea
              className="markdown-shell-editor"
              value={draft.content}
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              placeholder="# 直接粘贴 Markdown\n\n- 支持表格、任务列表、引用块\n- 保存后会进入右侧文档列表"
              spellCheck={false}
            />
          ) : (
            <div className="markdown-shell-preview">
              {draft.content.trim() ? (
                <MarkdownPreviewBoundary content={draft.content}>
                  <MarkdownPreviewContent content={draft.content} />
                </MarkdownPreviewBoundary>
              ) : (
                <div className="markdown-shell-preview-empty">
                  <p>这里会渲染 Markdown 预览。</p>
                  <p className="hint-text">切回“原始”即可继续编辑正文。</p>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="markdown-shell-side-panel">
          <section className="markdown-shell-card markdown-shell-documents-card">
            <div className="markdown-shell-card-header">
              <div>
                <h3>文档列表</h3>
                <p>
                  {selectedDate
                    ? `当前筛选 ${filteredDocuments.length} / ${documents.length} 篇`
                    : `共 ${documents.length} 篇文档`}
                </p>
              </div>
              <button type="button" className="markdown-shell-secondary-btn" onClick={handleCreateNew}>
                <Plus size={14} />
                新建
              </button>
            </div>

            <div className="markdown-shell-documents-list">
              {filteredDocuments.length === 0 ? (
                <div className="markdown-shell-empty-state">
                  <p>{documents.length === 0 ? "还没有 Markdown 文档" : "这个日期下没有文档"}</p>
                  <p className="hint-text">从左侧开始写第一篇，保存后会立即出现在列表中。</p>
                </div>
              ) : (
                filteredDocuments.map((document) => {
                  const isActive = document.id === draft.id;
                  const tags = parseClipboardTags(document.tags_json);

                  return (
                    <button
                      key={document.id}
                      type="button"
                      className={`markdown-shell-document-card ${isActive ? "is-active" : ""}`}
                      onClick={() => handleSelectDocument(document)}
                    >
                      <div className="markdown-shell-document-topline">
                        <span className="markdown-shell-document-title">{getDocumentTitle(document)}</span>
                        <span className="markdown-shell-document-time">
                          {formatDocumentTime(document.updated_at || document.created_at)}
                        </span>
                      </div>
                      <p className="markdown-shell-document-excerpt">{getDocumentExcerpt(document.content)}</p>
                      <div className="markdown-shell-document-footer">
                        <div className="markdown-shell-document-tags">
                          {tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="markdown-shell-tag-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="markdown-shell-document-date">
                          {tsToDateStr(document.updated_at || document.created_at)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="markdown-shell-card markdown-shell-calendar-card">
            <div className="markdown-shell-card-header is-calendar">
              <div>
                <h3>日历筛选</h3>
                <p>{selectedDate ? `已筛选 ${selectedDate}` : "按更新时间快速定位文档"}</p>
              </div>
              {selectedDate ? (
                <button
                  type="button"
                  className="markdown-shell-text-btn"
                  onClick={() => setSelectedDate(null)}
                >
                  清除
                </button>
              ) : (
                <CalendarDays size={16} className="markdown-shell-calendar-icon" />
              )}
            </div>

            <div className="markdown-shell-calendar-head">
              <button type="button" className="markdown-shell-calendar-nav" onClick={handlePreviousMonth}>
                <ChevronLeft size={16} />
              </button>
              <div className="markdown-shell-calendar-title">
                {calendarDate.year} 年 {calendarDate.month + 1} 月
              </div>
              <button type="button" className="markdown-shell-calendar-nav" onClick={handleNextMonth}>
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="markdown-shell-calendar-weekdays">
              {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="markdown-shell-calendar-grid">
              {calendarRows.flat().map((day, index) => {
                if (!day) {
                  return <span key={`blank-${index}`} className="markdown-shell-calendar-cell is-empty" />;
                }

                const dayKey = `${calendarDate.year}-${String(calendarDate.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasData = datesWithData.has(dayKey);
                const isSelected = selectedDate === dayKey;

                return (
                  <button
                    key={dayKey}
                    type="button"
                    className={`markdown-shell-calendar-cell ${hasData ? "has-data" : ""} ${
                      isSelected ? "is-selected" : ""
                    }`}
                    onClick={() => (hasData ? setSelectedDate(isSelected ? null : dayKey) : undefined)}
                    disabled={!hasData}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}