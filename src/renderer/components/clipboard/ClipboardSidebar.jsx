import React from "react";
import { ChevronLeft, ChevronRight, Copy, Pencil } from "lucide-react";
import {
  buildCalendarMatrix,
  getClipboardDisplayTitle,
  parseClipboardTags,
  truncateText,
  tsToDateStr,
} from "./clipboard-utils";

export default function ClipboardSidebar({
  filteredReusableItems,
  selectedItemId,
  onSelectItem,
  onCopy,
  itemsCount,
  filteredItemsCount,
  reusableItemsCount,
  calendarDate,
  onPreviousMonth,
  onNextMonth,
  datesWithData,
  selectedDate,
  onSelectDate,
  onClearSelectedDate,
}) {
  const todayStr = tsToDateStr(Date.now());

  return (
    <aside className="clipboard-shell-panel clipboard-shell-side-panel">
      <div className="clipboard-shell-section-head">
        <strong>可复用知识块</strong>
      </div>

      {filteredReusableItems.length === 0 ? (
        <div className="clipboard-shell-reusable-empty">
          <p>还没有收藏的内容</p>
          <p className="hint-text">把历史内容加入收藏后会显示在这里。</p>
        </div>
      ) : (
        <div className="clipboard-shell-reusable-list">
          {filteredReusableItems.map((item) => {
            const itemTags = parseClipboardTags(item.tags_json);

            return (
              <article
                key={`reusable-${item.id}`}
                className={[
                  "clipboard-shell-reusable-card",
                  selectedItemId === item.id ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onSelectItem(item)}
              >
                <div className="clipboard-shell-reusable-head">
                  <div>
                    <strong className="clipboard-shell-reusable-title">
                      {getClipboardDisplayTitle(item)}
                    </strong>
                    <div className="clipboard-shell-card-pills">
                      {Number(item.is_favorite) === 1 && (
                        <span className="clipboard-shell-pill is-favorite">收藏</span>
                      )}
                    </div>
                  </div>
                  <div
                    className="clipboard-shell-actions"
                    onClick={(event) => event.stopPropagation()}
                  >
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
                      className="clipboard-shell-icon-btn"
                      title="编辑知识块"
                      onClick={() => onSelectItem(item)}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                <p className="clipboard-shell-reusable-text">
                  {truncateText(item.content || "", 72) || "空模板"}
                </p>
                {itemTags.length > 0 && (
                  <div className="clipboard-shell-tags">
                    {itemTags.map((tag) => (
                      <span key={`side-${item.id}-${tag}`} className="clipboard-shell-tag-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="clipboard-shell-section-head" style={{ marginTop: 16 }}>
        <strong>状态概览</strong>
        <span>Stats</span>
      </div>
      <div className="clipboard-shell-kpi">
        <div className="clipboard-shell-kpi-card">
          <div className="clipboard-shell-kpi-label">总记录</div>
          <strong className="clipboard-shell-kpi-value">{itemsCount}</strong>
        </div>
        <div className="clipboard-shell-kpi-card">
          <div className="clipboard-shell-kpi-label">筛选结果</div>
          <strong className="clipboard-shell-kpi-value">{filteredItemsCount}</strong>
        </div>
        <div className="clipboard-shell-kpi-card">
          <div className="clipboard-shell-kpi-label">知识块</div>
          <strong className="clipboard-shell-kpi-value">{reusableItemsCount}</strong>
        </div>
      </div>

      <div className="clipboard-shell-section-head" style={{ marginTop: 16 }}>
        <strong>日期筛选</strong>
        <span>
          {selectedDate && (
            <button
              type="button"
              className="clipboard-shell-cal-reset"
              onClick={onClearSelectedDate}
            >
              清除
            </button>
          )}
        </span>
      </div>

      <div className="clipboard-shell-calendar">
        <div className="clipboard-shell-cal-header">
          <button
            type="button"
            className="clipboard-shell-cal-nav"
            onClick={onPreviousMonth}
          >
            <ChevronLeft size={13} />
          </button>
          <span className="clipboard-shell-cal-month">
            {calendarDate.year} 年 {calendarDate.month + 1} 月
          </span>
          <button
            type="button"
            className="clipboard-shell-cal-nav"
            onClick={onNextMonth}
          >
            <ChevronRight size={13} />
          </button>
        </div>
        <div className="clipboard-shell-cal-weekdays">
          {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => (
            <span key={weekday} className="clipboard-shell-cal-wd">
              {weekday}
            </span>
          ))}
        </div>
        <div className="clipboard-shell-cal-grid">
          {buildCalendarMatrix(calendarDate.year, calendarDate.month).map((row, rowIndex) =>
            row.map((day, dayIndex) => {
              if (!day) {
                return (
                  <span
                    key={`${rowIndex}-${dayIndex}`}
                    className="clipboard-shell-cal-day is-empty"
                  />
                );
              }

              const dateStr = `${calendarDate.year}-${String(calendarDate.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const hasData = datesWithData.has(dateStr);
              const isActive = selectedDate === dateStr;

              return (
                <button
                  key={`${rowIndex}-${dayIndex}`}
                  type="button"
                  className={[
                    "clipboard-shell-cal-day",
                    isToday ? "is-today" : "",
                    hasData ? "has-data" : "",
                    isActive ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelectDate(isActive ? null : dateStr)}
                  disabled={!hasData}
                >
                  {day}
                  {hasData && <i className="clipboard-shell-cal-dot" />}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </aside>
  );
}