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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedTitleDraft, setSelectedTitleDraft] = useState("");
  const [selectedTagsDraft, setSelectedTagsDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [opTip, setOpTip] = useState("");
  const tipTimerRef = useRef(null);
  const reusableSignatureRef = useRef("");
  const isLoadingHistoryRef = useRef(false);
  const isLoadingReusableRef = useRef(false);
  const hasPendingRefreshRef = useRef(false);
  const isMountedRef = useRef(false);
  const itemsRef = useRef([]);
  const nextHistoryOffsetRef = useRef(0);
  const searchQueryRef = useRef("");
  const selectedDateRef = useRef(null);
  const hasMountedFiltersRef = useRef(false);

  const todayObj = new Date();
  const [calendarDate, setCalendarDate] = useState({
    year: todayObj.getFullYear(),
    month: todayObj.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  function showTip(text) {
    setOpTip(text);
    clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setOpTip(""), 1400);
  }

  const loadReusableItems = useCallback(async () => {
    if (isLoadingReusableRef.current) {
      return;
    }

    isLoadingReusableRef.current = true;

    try {
      const reusableData = await window.api.getReusableClipboardItems();
      if (!isMountedRef.current) return;

      const reusableBlocks = Array.isArray(reusableData) ? reusableData : [];
      const nextReusableSignature = buildClipboardSignature(reusableBlocks);
      if (nextReusableSignature !== reusableSignatureRef.current) {
        reusableSignatureRef.current = nextReusableSignature;
        setReusableItems(reusableBlocks);
      }
    } catch {
      if (!isMountedRef.current) return;
      setErrorMessage("加载复制记录失败，请稍后重试");
    } finally {
      isLoadingReusableRef.current = false;
    }
  }, []);

  const loadClipboardState = useCallback(async ({ reset = false } = {}) => {
    if (isLoadingHistoryRef.current) {
      if (reset) {
        hasPendingRefreshRef.current = true;
      }
      return;
    }

    isLoadingHistoryRef.current = true;
    if (isMountedRef.current) {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
    }

    try {
      const historyData = await window.api.getClipboardHistoryPage({
        offset: reset ? 0 : nextHistoryOffsetRef.current,
        searchQuery: searchQueryRef.current,
        selectedDate: selectedDateRef.current,
      });
      if (!isMountedRef.current) return;

      const pageItems = Array.isArray(historyData?.items) ? historyData.items : [];
      const nextItems = reset ? pageItems : [...itemsRef.current, ...pageItems];
      nextHistoryOffsetRef.current = Number(historyData?.nextOffset) || nextItems.length;
      setItems(nextItems);
      setHasMore(Boolean(historyData?.hasMore));
      setHistoryTotalCount(Number(historyData?.totalCount) || nextItems.length);
      setErrorMessage("");
    } catch {
      if (!isMountedRef.current) return;
      setErrorMessage("加载复制记录失败，请稍后重试");
    } finally {
      isLoadingHistoryRef.current = false;

      if (isMountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }

      if (hasPendingRefreshRef.current && isMountedRef.current) {
        hasPendingRefreshRef.current = false;
        void loadClipboardState({ reset: true });
      }
    }
  }, []);

  const refreshClipboardState = useCallback(async () => {
    await Promise.all([loadClipboardState({ reset: true }), loadReusableItems()]);
  }, [loadClipboardState, loadReusableItems]);

  useEffect(() => {
    isMountedRef.current = true;
    void refreshClipboardState();
    const unsubscribe = window.api.onClipboardHistoryChanged(() => {
      void refreshClipboardState();
    });

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshClipboardState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      isLoadingHistoryRef.current = false;
      isLoadingReusableRef.current = false;
      hasPendingRefreshRef.current = false;
      clearTimeout(tipTimerRef.current);
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshClipboardState]);

  useEffect(() => {
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }

    void loadClipboardState({ reset: true });
  }, [searchQuery, selectedDate, loadClipboardState]);

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
        await refreshClipboardState();
      }
      showTip("已复制到系统剪贴板");
    } catch {
      setErrorMessage("复制失败，请重试");
    }
  }

  async function handleDelete(id) {
    try {
      await window.api.deleteClipboardItem(id);
      await refreshClipboardState();
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
      await refreshClipboardState();
      if (selectedItem && !isReusableItem(selectedItem)) {
        setSelectedItem(null);
      }
      setErrorMessage("");
      showTip("已清空普通历史");
    } catch {
      setErrorMessage("清空失败，请稍后重试");
    }
  }

  const groupedItems = useMemo(() => groupClipboardItemsByDate(items), [items]);

  const hasActiveHistoryFilters = Boolean(searchQuery.trim()) || Boolean(selectedDate);

  const handleLoadMoreHistory = useCallback(() => {
    if (!hasMore || loading || loadingMore) {
      return;
    }

    void loadClipboardState({ reset: false });
  }, [hasMore, loadClipboardState, loading, loadingMore]);

  async function handleToggleFavorite(item) {
    try {
      const updatedItem = await window.api.updateClipboardItem(item.id, {
        isFavorite: !Boolean(Number(item.is_favorite)),
      });
      await refreshClipboardState();
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
      await refreshClipboardState();
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

      {!hasActiveHistoryFilters && historyTotalCount === 0 ? (
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
              hasMore={hasMore}
              isLoadingMore={loadingMore}
              onReachEnd={handleLoadMoreHistory}
            />
          </article>
          <ClipboardSidebar
            filteredReusableItems={filteredReusableItems}
            selectedItemId={selectedItem?.id ?? null}
            onSelectItem={setSelectedItem}
            onCopy={handleCopy}
            itemsCount={historyTotalCount}
            filteredItemsCount={historyTotalCount}
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