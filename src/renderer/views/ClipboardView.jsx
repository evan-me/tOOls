import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ClipboardHistoryTimeline from "../components/clipboard/ClipboardHistoryTimeline";
import ClipboardItemModal from "../components/clipboard/ClipboardItemModal";
import ClipboardSearchHeader from "../components/clipboard/ClipboardSearchHeader";
import ClipboardSidebar from "../components/clipboard/ClipboardSidebar";
import {
  buildClipboardSearchText,
  buildClipboardSignature,
  groupClipboardItemsByDate,
  isReusableItem,
  parseClipboardTags,
  parseTagInput,
  sortReusableItems,
  tagsToInputValue,
  tsToDateStr,
} from "../components/clipboard/clipboard-utils";

export default function ClipboardView() {
  const [items, setItems] = useState([]);
  const [reusableItems, setReusableItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedTitleDraft, setSelectedTitleDraft] = useState("");
  const [selectedTagsDraft, setSelectedTagsDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [opTip, setOpTip] = useState("");
  const tipTimerRef = useRef(null);
  const historySignatureRef = useRef("");
  const reusableSignatureRef = useRef("");
  const isLoadingHistoryRef = useRef(false);
  const hasPendingRefreshRef = useRef(false);
  const isMountedRef = useRef(false);

  const todayObj = new Date();
  const [calendarDate, setCalendarDate] = useState({
    year: todayObj.getFullYear(),
    month: todayObj.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState(null);

  function showTip(text) {
    setOpTip(text);
    clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setOpTip(""), 1400);
  }

  const loadClipboardState = useCallback(async () => {
    if (isLoadingHistoryRef.current) {
      hasPendingRefreshRef.current = true;
      return;
    }

    isLoadingHistoryRef.current = true;

    try {
      const [historyData, reusableData] = await Promise.all([
        window.api.getClipboardHistory(),
        window.api.getReusableClipboardItems(),
      ]);
      if (!isMountedRef.current) return;

      const historyItems = Array.isArray(historyData) ? historyData : [];
      const reusableBlocks = Array.isArray(reusableData) ? reusableData : [];
      const nextHistorySignature = buildClipboardSignature(historyItems);
      const nextReusableSignature = buildClipboardSignature(reusableBlocks);

      if (nextHistorySignature !== historySignatureRef.current) {
        historySignatureRef.current = nextHistorySignature;
        setItems(historyItems);
      }

      if (nextReusableSignature !== reusableSignatureRef.current) {
        reusableSignatureRef.current = nextReusableSignature;
        setReusableItems(reusableBlocks);
      }

      setErrorMessage("");
    } catch {
      if (!isMountedRef.current) return;
      setErrorMessage("加载复制记录失败，请稍后重试");
    } finally {
      isLoadingHistoryRef.current = false;

      if (isMountedRef.current) {
        setLoading(false);
      }

      if (hasPendingRefreshRef.current && isMountedRef.current) {
        hasPendingRefreshRef.current = false;
        void loadClipboardState();
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadClipboardState();
    const unsubscribe = window.api.onClipboardHistoryChanged(() => {
      loadClipboardState();
    });

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadClipboardState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      isLoadingHistoryRef.current = false;
      hasPendingRefreshRef.current = false;
      clearTimeout(tipTimerRef.current);
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadClipboardState]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedTitleDraft("");
      setSelectedTagsDraft("");
      return;
    }

    setSelectedTitleDraft(selectedItem.title || "");
    setSelectedTagsDraft(tagsToInputValue(parseClipboardTags(selectedItem.tags_json)));
  }, [selectedItem]);

  const datesWithData = useMemo(() => {
    const s = new Set();
    items.forEach((item) => s.add(tsToDateStr(item.created_at)));
    return s;
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => buildClipboardSearchText(item).includes(query));
    }
    if (selectedDate) {
      result = result.filter((item) => tsToDateStr(item.created_at) === selectedDate);
    }
    return result;
  }, [items, searchQuery, selectedDate]);

  const filteredReusableItems = useMemo(() => {
    let result = reusableItems;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => buildClipboardSearchText(item).includes(query));
    }
    return [...result].sort(sortReusableItems);
  }, [reusableItems, searchQuery]);

  const plainHistoryCount = useMemo(
    () => items.filter((item) => !isReusableItem(item)).length,
    [items],
  );

  async function handleCopy(item) {
    try {
      await window.api.copyToSystem(item.content, {
        itemId: isReusableItem(item) ? item.id : null,
      });
      if (isReusableItem(item)) {
        await loadClipboardState();
      }
      showTip("已复制到系统剪贴板");
    } catch {
      setErrorMessage("复制失败，请重试");
    }
  }

  async function handleDelete(id) {
    try {
      await window.api.deleteClipboardItem(id);
      await loadClipboardState();
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem(null);
      }
      setErrorMessage("");
      showTip("记录已删除");
    } catch {
      setErrorMessage("删除失败，请稍后重试");
    }
  }

  async function handleClearAll() {
    if (!confirm("确定清空普通历史记录？收藏内容会保留。")) return;
    try {
      await window.api.clearClipboardHistory();
      await loadClipboardState();
      if (selectedItem && !isReusableItem(selectedItem)) {
        setSelectedItem(null);
      }
      setErrorMessage("");
      showTip("已清空普通历史");
    } catch {
      setErrorMessage("清空失败，请稍后重试");
    }
  }

  const groupedItems = useMemo(
    () => groupClipboardItemsByDate(filteredItems),
    [filteredItems],
  );

  async function handleToggleFavorite(item) {
    try {
      const updatedItem = await window.api.updateClipboardItem(item.id, {
        isFavorite: !Boolean(Number(item.is_favorite)),
      });
      await loadClipboardState();
      if (selectedItem && selectedItem.id === item.id) {
        setSelectedItem(updatedItem);
      }
      setErrorMessage("");
      showTip(Boolean(Number(item.is_favorite)) ? "已取消收藏" : "已加入收藏");
    } catch {
      setErrorMessage("更新收藏状态失败，请稍后重试");
    }
  }

  async function handleSaveSelectedMetadata() {
    if (!selectedItem || !isReusableItem(selectedItem)) {
      return;
    }

    try {
      const updatedItem = await window.api.updateClipboardItem(selectedItem.id, {
        title: selectedTitleDraft,
        tags: parseTagInput(selectedTagsDraft),
      });
      await loadClipboardState();
      setSelectedItem(updatedItem);
      setErrorMessage("");
      showTip("知识块信息已更新");
    } catch {
      setErrorMessage("保存知识块信息失败，请稍后重试");
    }
  }

  function handlePreviousCalendarMonth() {
    setCalendarDate(({ year, month }) => {
      const date = new Date(year, month - 1, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function handleNextCalendarMonth() {
    setCalendarDate(({ year, month }) => {
      const date = new Date(year, month + 1, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  if (loading) {
    return (
      <div className="view-container clipboard-shell-view">
        <div className="clipboard-shell-loading">加载中…</div>
      </div>
    );
  }

  return (
    <div className="view-container clipboard-shell-view">
      {errorMessage && <div className="clipboard-shell-error">{errorMessage}</div>}

      {items.length === 0 ? (
        <div className="empty-hint clipboard-shell-empty">
          <p>还没有复制记录</p>
          <p className="hint-text">在任意地方复制内容后，会自动出现在这里</p>
        </div>
      ) : (
        <div className="clipboard-shell-workspace">
          <article className="clipboard-shell-panel">
            <ClipboardSearchHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery("")}
              plainHistoryCount={plainHistoryCount}
              onClearAll={handleClearAll}
              opTip={opTip}
            />
            <ClipboardHistoryTimeline
              groupedItems={groupedItems}
              selectedItemId={selectedItem?.id ?? null}
              onSelectItem={setSelectedItem}
              onToggleFavorite={handleToggleFavorite}
              onCopy={handleCopy}
              onDelete={handleDelete}
            />
          </article>
          <ClipboardSidebar
            filteredReusableItems={filteredReusableItems}
            selectedItemId={selectedItem?.id ?? null}
            onSelectItem={setSelectedItem}
            onCopy={handleCopy}
            itemsCount={items.length}
            filteredItemsCount={filteredItems.length}
            reusableItemsCount={reusableItems.length}
            calendarDate={calendarDate}
            onPreviousMonth={handlePreviousCalendarMonth}
            onNextMonth={handleNextCalendarMonth}
            datesWithData={datesWithData}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onClearSelectedDate={() => setSelectedDate(null)}
          />
        </div>
      )}
      <ClipboardItemModal
        item={selectedItem}
        titleDraft={selectedTitleDraft}
        tagsDraft={selectedTagsDraft}
        onChangeTitleDraft={setSelectedTitleDraft}
        onChangeTagsDraft={setSelectedTagsDraft}
        onClose={() => setSelectedItem(null)}
        onToggleFavorite={handleToggleFavorite}
        onSaveMetadata={handleSaveSelectedMetadata}
        onCopy={handleCopy}
      />

    </div>
  );
}