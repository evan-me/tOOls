import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Circle,
  CheckCircle,
  X,
  List,
  ChevronLeft,
  ChevronRight,
  Pin,
  Flag,
  CalendarDays,
} from "lucide-react";
import TodoInsightsPanel from "../components/todo/TodoInsightsPanel";

const BUILTIN_LISTS = [
  { id: "all", name: "全部任务", icon: List, builtIn: true },
  { id: "today", name: "今天", icon: Calendar, builtIn: true },
  { id: "completed", name: "已完成", icon: CheckCircle2, builtIn: true },
];

const PRIORITY_OPTIONS = [
  { value: 0, label: "低级" },
  { value: 1, label: "普通" },
  { value: 2, label: "高级" },
];

const REMINDER_PRESET_OPTIONS = [
  { value: "none", label: "不提醒" },
  { value: "day-before-9am", label: "提前一天 09:00" },
  { value: "same-day-9am", label: "当天 09:00" },
  {
    value: "day-before-and-same-day-9am",
    label: "提前一天 + 当天 09:00",
  },
];

const DEFAULT_WORKSPACE = {
  summary: {
    total: 0,
    done: 0,
    active: 0,
    completionRate: 0,
    focusLabel: "开始第一项任务",
  },
  quickFilters: [
    { id: "today", label: "今天到期", count: 0 },
    { id: "pinned", label: "已置顶", count: 0 },
    { id: "high", label: "高优先级", count: 0 },
    { id: "completed", label: "已完成", count: 0 },
  ],
  recentCompleted: [],
  calendarDots: [],
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function getTaskReferenceTimestamp(todo) {
  return todo.due_at || todo.created_at;
}

function getDayKey(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDayWindow(timestamp = Date.now()) {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function isTodayTimestamp(timestamp) {
  if (!timestamp) return false;
  const { start, end } = getDayWindow();
  return timestamp >= start && timestamp < end;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `今天 ${timeStr}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  ) {
    return `明天 ${timeStr}`;
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
}

function formatDateLabel(dateValue) {
  if (!dateValue) return "";
  return dateValue.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日");
}

function formatDateInput(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function formatDueLabel(timestamp) {
  if (!timestamp) return null;
  if (isTodayTimestamp(timestamp)) return "今天截止";
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日截止`;
}

function getPriorityMeta(priority) {
  return PRIORITY_OPTIONS.find((item) => item.value === Number(priority)) || PRIORITY_OPTIONS[1];
}

function getReminderPresetMeta(preset) {
  return (
    REMINDER_PRESET_OPTIONS.find((item) => item.value === preset) ||
    REMINDER_PRESET_OPTIONS[0]
  );
}

function matchesQuickFilter(todo, quickFilter) {
  if (quickFilter === "all") return true;
  if (quickFilter === "today") return isTodayTimestamp(getTaskReferenceTimestamp(todo));
  if (quickFilter === "pinned") return Boolean(todo.is_pinned);
  if (quickFilter === "high") return Number(todo.priority) === 2;
  if (quickFilter === "completed") return Boolean(todo.completed);
  return true;
}

export default function TodoWorkbenchView({ navigationRequest = null }) {
  const [lists, setLists] = useState([]);
  const [activeList, setActiveList] = useState("all");
  const [todos, setTodos] = useState([]);
  const [workspaceMeta, setWorkspaceMeta] = useState(DEFAULT_WORKSPACE);
  const [newTodo, setNewTodo] = useState("");
  const [newTodoNote, setNewTodoNote] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState(1);
  const [newTodoDueDate, setNewTodoDueDate] = useState("");
  const [newTodoReminderPreset, setNewTodoReminderPreset] = useState("none");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calSelectedDate, setCalSelectedDate] = useState(null);
  const [calCollapsed, setCalCollapsed] = useState(true);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [viewFilter, setViewFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [actionError, setActionError] = useState("");
  const [highlightedTodoId, setHighlightedTodoId] = useState(null);
  const addInputRef = useRef(null);
  const editInputRef = useRef(null);

  const loadLists = useCallback(async () => {
    const data = await window.api.getTodoLists();
    setLists(data);
  }, []);

  const loadTodos = useCallback(async () => {
    const data = await window.api.getTodos(activeList);
    setTodos(data);
  }, [activeList]);

  const loadWorkspace = useCallback(async () => {
    const data = await window.api.getTodoWorkspace();
    setWorkspaceMeta({ ...DEFAULT_WORKSPACE, ...data });
  }, []);

  const refreshTodoData = useCallback(
    async ({ includeLists = false } = {}) => {
      const jobs = [loadTodos(), loadWorkspace()];
      if (includeLists) jobs.push(loadLists());
      await Promise.all(jobs);
    },
    [loadLists, loadTodos, loadWorkspace],
  );

  const runMutation = useCallback(
    async (work, { includeLists = false, message = "操作失败，请稍后重试" } = {}) => {
      try {
        setActionError("");
        await work();
        await refreshTodoData({ includeLists });
        return true;
      } catch (error) {
        console.error(error);
        setActionError(message);
        return false;
      }
    },
    [refreshTodoData],
  );

  useEffect(() => {
    loadLists();
    loadWorkspace();
  }, [loadLists, loadWorkspace]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(""), 4000);
    return () => clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    if (!navigationRequest || navigationRequest.menuId !== "todo") {
      return;
    }

    const nextListId =
      navigationRequest.listId === null || navigationRequest.listId === undefined
        ? "all"
        : String(navigationRequest.listId);

    setActiveList(nextListId || "all");
    setCalSelectedDate(null);
    setQuickFilter("all");
    setViewFilter("all");
    setShowAddForm(false);
    setEditingId(null);
    setEditDraft(null);
    setHighlightedTodoId(
      typeof navigationRequest.todoId === "number" ? navigationRequest.todoId : null,
    );
  }, [navigationRequest]);

  useEffect(() => {
    if (highlightedTodoId === null) return undefined;
    const timer = setTimeout(() => setHighlightedTodoId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedTodoId]);

  function handleNewTodoDueDateChange(event) {
    const nextDueDate = event.target.value;
    setNewTodoDueDate(nextDueDate);
    if (!nextDueDate) {
      setNewTodoReminderPreset("none");
    }
  }

  function handleEditDueDateChange(event) {
    const nextDueDate = event.target.value;
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        dueDate: nextDueDate,
        reminderPreset: nextDueDate ? current.reminderPreset : "none",
      };
    });
  }

  async function handleAddTodo(event) {
    event.preventDefault();
    const title = newTodo.trim();
    if (!title) {
      setActionError("请输入任务标题");
      return;
    }
    const success = await runMutation(
      () =>
        window.api.addTodo(title, activeList, {
          priority: newTodoPriority,
          note: newTodoNote,
          dueAt: parseDateInput(newTodoDueDate),
          reminderPreset: newTodoReminderPreset,
        }),
      { message: "添加待办失败" },
    );
    if (!success) return;
    setNewTodo("");
    setNewTodoNote("");
    setNewTodoPriority(1);
    setNewTodoDueDate("");
    setNewTodoReminderPreset("none");
    setShowAddForm(false);
  }

  async function handleToggle(id) {
    await runMutation(() => window.api.toggleTodo(id), {
      message: "更新任务状态失败",
    });
  }

  async function handleDelete(id) {
    await runMutation(() => window.api.deleteTodo(id), {
      message: "删除任务失败",
    });
  }

  function handleStartEdit(todo) {
    setEditingId(todo.id);
    setEditDraft({
      title: todo.title,
      note: todo.note || "",
      priority: Number(todo.priority ?? 1),
      dueDate: formatDateInput(todo.due_at),
      reminderPreset: todo.reminder_preset || "none",
      isPinned: Boolean(todo.is_pinned),
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function handleSaveEdit(id) {
    if (!editDraft) return;
    const title = editDraft.title.trim();
    if (!title) {
      setActionError("任务标题不能为空");
      return;
    }
    const success = await runMutation(
      () =>
        window.api.updateTodo(id, {
          title,
          note: editDraft.note,
          priority: editDraft.priority,
          dueAt: parseDateInput(editDraft.dueDate),
          reminderPreset: editDraft.reminderPreset,
          isPinned: editDraft.isPinned,
        }),
      { message: "保存任务失败" },
    );
    if (!success) return;
    handleCancelEdit();
  }

  function handleCancelAdd() {
    setShowAddForm(false);
    setNewTodo("");
    setNewTodoNote("");
    setNewTodoPriority(1);
    setNewTodoDueDate("");
    setNewTodoReminderPreset("none");
  }

  async function handlePinToggle(todo) {
    await runMutation(
      () => window.api.updateTodo(todo.id, { isPinned: !Boolean(todo.is_pinned) }),
      { message: "更新置顶状态失败" },
    );
  }

  function handleResetFilters() {
    if (activeList === "completed") {
      setActiveList("all");
    }
    setCalSelectedDate(null);
    setQuickFilter("all");
    setViewFilter("all");
    setActionError("");
  }

  function handleQuickFilterSelect(filterId) {
    if (filterId === "completed") {
      setActiveList("completed");
      setViewFilter("done");
      setQuickFilter("all");
      return;
    }

    if (activeList === "completed") {
      setActiveList("all");
      setViewFilter("all");
    }

    setQuickFilter((current) => (current === filterId ? "all" : filterId));
  }

  const activeListObj =
    BUILTIN_LISTS.find((item) => item.id === activeList) ||
    lists.find((item) => String(item.id) === activeList);
  const activeListLabel = activeListObj
    ? activeListObj.name || activeListObj.label
    : "全部任务";

  const dateScopedTodos = calSelectedDate
    ? todos.filter((todo) => getDayKey(getTaskReferenceTimestamp(todo)) === calSelectedDate)
    : todos;
  const effectiveQuickFilter = activeList === "completed" ? "completed" : quickFilter;
  const quickFilteredTodos =
    activeList === "completed"
      ? dateScopedTodos
      : dateScopedTodos.filter((todo) => matchesQuickFilter(todo, effectiveQuickFilter));
  const uncompleted = quickFilteredTodos.filter((todo) => !todo.completed);
  const completed = quickFilteredTodos.filter((todo) => todo.completed);
  const effectiveViewFilter = activeList === "completed" ? "done" : viewFilter;
  const visibleUncompleted = effectiveViewFilter === "done" ? [] : uncompleted;
  const visibleCompleted = effectiveViewFilter === "active" ? [] : completed;
  const shouldPinCompletedToBottom =
    activeList !== "completed" &&
    effectiveViewFilter !== "done" &&
    visibleUncompleted.length > 0 &&
    visibleCompleted.length > 0;

  let emptyMessage = activeList === "completed" ? "暂无已完成任务" : "暂无待办事项";
  if (dateScopedTodos.length === 0 && todos.length > 0) {
    emptyMessage = calSelectedDate ? "当日暂无任务" : "当前列表暂无任务";
  } else if (
    quickFilteredTodos.length === 0 &&
    dateScopedTodos.length > 0 &&
    effectiveQuickFilter !== "all"
  ) {
    emptyMessage = "当前快捷筛选下暂无任务";
  } else if (
    quickFilteredTodos.length > 0 &&
    visibleUncompleted.length === 0 &&
    visibleCompleted.length === 0
  ) {
    emptyMessage = "当前状态筛选下暂无任务";
  }

  const datesWithTodos = useMemo(
    () => new Set(workspaceMeta.calendarDots),
    [workspaceMeta.calendarDots],
  );

  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const calPrevDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const calCells = [];
  for (let index = 0; index < calFirstDayOfWeek; index += 1) {
    calCells.push({
      day: calPrevDays - calFirstDayOfWeek + 1 + index,
      currentMonth: false,
      date: null,
    });
  }
  for (let day = 1; day <= calDaysInMonth; day += 1) {
    const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
    calCells.push({
      day,
      currentMonth: true,
      date: dateStr,
      isToday: dateStr === todayStr,
      hasTodo: datesWithTodos.has(dateStr),
      isSelected: dateStr === calSelectedDate,
    });
  }
  const remaining = 7 - (calCells.length % 7);
  if (remaining < 7) {
    for (let day = 1; day <= remaining; day += 1) {
      calCells.push({ day, currentMonth: false, date: null });
    }
  }

  function calPrev() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((current) => current - 1);
      return;
    }
    setCalMonth((current) => current - 1);
  }

  function calNext() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((current) => current + 1);
      return;
    }
    setCalMonth((current) => current + 1);
  }

  function renderTodoCard(todo, cardType) {
    const isCompletedCard = cardType === "completed" || cardType === "completed-page";
    const isCompactCompletedCard = cardType === "completed";
    const priorityMeta = getPriorityMeta(todo.priority);
    const dueLabel = formatDueLabel(todo.due_at);
    const reminderMeta = getReminderPresetMeta(todo.reminder_preset || "none");

    return (
      <div
        key={todo.id}
        className={`todo-shell-card ${isCompactCompletedCard ? "is-completed-compact" : ""} ${highlightedTodoId === todo.id ? "is-highlighted" : ""}`}
      >
        <button
          type="button"
          className={`todo-shell-checkbox ${isCompletedCard ? "is-completed" : ""}`}
          onClick={() => handleToggle(todo.id)}
          title={isCompletedCard ? "标记未完成" : "标记完成"}
        >
          {isCompletedCard ? <CheckCircle size={20} /> : <Circle size={20} />}
        </button>

        <div className="todo-shell-card-body">
          {editingId === todo.id && editDraft ? (
            <div className="todo-shell-editor">
              <input
                ref={editInputRef}
                className="todo-shell-edit-input"
                value={editDraft.title}
                onChange={(event) =>
                  setEditDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
              <textarea
                className="todo-shell-edit-note"
                value={editDraft.note}
                placeholder="补充备注（可选）"
                onChange={(event) =>
                  setEditDraft((current) => ({ ...current, note: event.target.value }))
                }
              />
              <div className="todo-shell-editor-row">
                <select
                  className="todo-shell-select"
                  value={editDraft.priority}
                  onChange={(event) =>
                    setEditDraft((current) => ({
                      ...current,
                      priority: Number(event.target.value),
                    }))
                  }
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="todo-shell-date-input"
                  value={editDraft.dueDate}
                  onChange={handleEditDueDateChange}
                />
                <select
                  className="todo-shell-select todo-shell-reminder-select"
                  value={editDraft.reminderPreset}
                  onChange={(event) =>
                    setEditDraft((current) => ({
                      ...current,
                      reminderPreset: event.target.value,
                    }))
                  }
                  disabled={!editDraft.dueDate}
                >
                  {REMINDER_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label className="todo-shell-pin-toggle">
                  <input
                    type="checkbox"
                    checked={editDraft.isPinned}
                    onChange={(event) =>
                      setEditDraft((current) => ({
                        ...current,
                        isPinned: event.target.checked,
                      }))
                    }
                  />
                  置顶
                </label>
              </div>
              <div className="todo-shell-editor-actions">
                <button
                  type="button"
                  className="todo-shell-mini-btn is-primary"
                  onClick={() => handleSaveEdit(todo.id)}
                >
                  保存
                </button>
                <button type="button" className="todo-shell-mini-btn" onClick={handleCancelEdit}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`todo-shell-card-content ${isCompactCompletedCard ? "is-compact" : ""}`}
              onDoubleClick={() => !isCompletedCard && handleStartEdit(todo)}
            >
              {isCompactCompletedCard ? (
                <div className="todo-shell-card-heading is-compact">
                  <span className="todo-shell-card-title is-completed">{todo.title}</span>
                  <span className="todo-shell-card-meta is-compact">
                    {formatDate(todo.completed_at || todo.created_at)}
                  </span>
                </div>
              ) : (
                <>
                  <div className="todo-shell-card-heading">
                    <span className={`todo-shell-card-title ${isCompletedCard ? "is-completed" : ""}`}>
                      {todo.title}
                    </span>
                    <div className="todo-shell-card-badges">
                      {Number(todo.priority) === 2 && (
                        <span className="todo-shell-badge-chip is-high">
                          <Flag size={11} /> {priorityMeta.label}
                        </span>
                      )}
                      {dueLabel && (
                        <span className="todo-shell-badge-chip">
                          <CalendarDays size={11} /> {dueLabel}
                        </span>
                      )}
                      {reminderMeta.value !== "none" && (
                        <span className="todo-shell-badge-chip is-reminder">
                          {reminderMeta.label}
                        </span>
                      )}
                      {!isCompletedCard && todo.list_name && (
                        <span className="todo-shell-badge-chip is-soft">{todo.list_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="todo-shell-card-meta">
                    <span>
                      {isCompletedCard
                        ? formatDate(todo.completed_at || todo.created_at)
                        : formatDate(todo.created_at)}
                    </span>
                    {Boolean(todo.is_pinned) && <span>已置顶</span>}
                    {Number(todo.priority) !== 2 && <span>{priorityMeta.label}</span>}
                  </div>
                  {todo.note && <p className="todo-shell-card-note">{todo.note}</p>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="todo-shell-card-actions">
          {!isCompletedCard && editingId !== todo.id && (
            <button
              type="button"
              className={`todo-shell-icon-btn ${Boolean(todo.is_pinned) ? "is-active" : ""}`}
              onClick={() => handlePinToggle(todo)}
              title={Boolean(todo.is_pinned) ? "取消置顶" : "置顶任务"}
            >
              <Pin size={14} />
            </button>
          )}
          <button
            type="button"
            className="todo-shell-icon-btn is-danger"
            onClick={() => handleDelete(todo.id)}
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const selectedDateLabel = formatDateLabel(calSelectedDate);
  const nowDate = new Date();
  const nowDayLabel = weekdays[nowDate.getDay()];
  const collapsedTodayText = `${nowDate.getFullYear()}年${nowDate.getMonth() + 1}月${nowDate.getDate()}日 周${nowDayLabel}`;
  const activeQuickFilterIndicator =
    activeList === "completed" ? "completed" : effectiveQuickFilter;

  return (
    <div className="view-container todo-workbench">
      {actionError && <div className="todo-workbench-feedback is-error">{actionError}</div>}

      <div className="todo-workbench-grid">
        <section className="todo-workbench-main-panel">
          <div className="todo-shell-layout">
            <section className="todo-shell-main">
              <div className="todo-shell-calendar-card">
                {calCollapsed ? (
                  <div
                    className="todo-shell-cal-collapsed"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCalCollapsed(false);
                    }}
                  >
                    <Calendar size={14} />
                    <span className="todo-shell-cal-collapsed-text">
                      {calSelectedDate ? selectedDateLabel : collapsedTodayText}
                    </span>
                    {calSelectedDate && (
                      <button
                        type="button"
                        className="todo-shell-cal-clear"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCalSelectedDate(null);
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                    <ChevronRight size={14} />
                  </div>
                ) : (
                  <>
                    <div className="todo-shell-cal-header">
                      <button type="button" className="todo-shell-cal-nav" onClick={calPrev}>
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="todo-shell-cal-title"
                        onClick={() => setCalCollapsed(true)}
                      >
                        {calYear}年{calMonth + 1}月
                      </button>
                      <button type="button" className="todo-shell-cal-nav" onClick={calNext}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="todo-shell-cal-weekdays">
                      {weekdays.map((day) => (
                        <div key={day} className="todo-shell-cal-weekday">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="todo-shell-cal-grid">
                      {calCells.map((cell, index) => {
                        const dayClasses = ["todo-shell-cal-day"];
                        if (!cell.currentMonth) dayClasses.push("is-outside");
                        if (cell.isToday) dayClasses.push("is-today");
                        if (cell.isSelected) dayClasses.push("is-selected");
                        if (cell.date) dayClasses.push("is-clickable");

                        return (
                          <button
                            key={`${cell.day}-${index}`}
                            type="button"
                            className={dayClasses.join(" ")}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!cell.date) return;
                              setCalSelectedDate(cell.date === calSelectedDate ? null : cell.date);
                            }}
                          >
                            <span>{cell.day}</span>
                            {cell.hasTodo && <span className="todo-shell-cal-dot" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <header className="todo-shell-main-header">
                <div className="todo-shell-title-block">
                  <h2 className="todo-shell-title">{activeListLabel}</h2>
                  <p className="todo-shell-count">
                    {quickFilteredTodos.length} 项任务 · {uncompleted.length} 个待办
                    {calSelectedDate && <span> · {selectedDateLabel}</span>}
                  </p>
                </div>
                <div className="todo-shell-main-tools">
                  {activeList !== "completed" && (
                    <div className="todo-shell-tabs" role="tablist" aria-label="任务显示筛选">
                      <button
                        type="button"
                        className={`todo-shell-tab ${effectiveViewFilter === "all" ? "is-active" : ""}`}
                        onClick={() => setViewFilter("all")}
                      >
                        全部
                      </button>
                      <button
                        type="button"
                        className={`todo-shell-tab ${effectiveViewFilter === "active" ? "is-active" : ""}`}
                        onClick={() => setViewFilter("active")}
                      >
                        进行中
                      </button>
                      <button
                        type="button"
                        className={`todo-shell-tab ${effectiveViewFilter === "done" ? "is-active" : ""}`}
                        onClick={() => setViewFilter("done")}
                      >
                        已完成
                      </button>
                    </div>
                  )}
                </div>
              </header>

              {!showAddForm ? (
                <button
                  type="button"
                  className="todo-shell-add-trigger"
                  onClick={() => {
                    setNewTodoDueDate(calSelectedDate || todayStr);
                    setShowAddForm(true);
                    setTimeout(() => addInputRef.current?.focus(), 0);
                  }}
                >
                  <Plus size={16} />
                  {calSelectedDate ? `添加到 ${selectedDateLabel}` : "添加待办事项"}
                </button>
              ) : (
                <form onSubmit={handleAddTodo} className="todo-shell-add-form">
                  <div className="todo-shell-add-form-main">
                    <Plus size={18} className="todo-shell-add-icon" />
                    <input
                      ref={addInputRef}
                      className="todo-shell-add-input"
                      value={newTodo}
                      onChange={(event) => setNewTodo(event.target.value)}
                      placeholder={calSelectedDate ? `添加到 ${selectedDateLabel}` : "待办事项标题"}
                    />
                  </div>
                  <div className="todo-shell-composer-tools">
                    <select
                      className="todo-shell-select"
                      value={newTodoPriority}
                      onChange={(event) => setNewTodoPriority(Number(event.target.value))}
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="todo-shell-date-input"
                      value={newTodoDueDate}
                      onChange={handleNewTodoDueDateChange}
                    />
                    <select
                      className="todo-shell-select todo-shell-reminder-select"
                      value={newTodoReminderPreset}
                      onChange={(event) => setNewTodoReminderPreset(event.target.value)}
                      disabled={!newTodoDueDate}
                    >
                      {REMINDER_PRESET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="todo-shell-add-form-actions">
                    <button type="submit" className="todo-shell-mini-btn is-primary">
                      保存
                    </button>
                    <button
                      type="button"
                      className="todo-shell-mini-btn"
                      onClick={handleCancelAdd}
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}

              <div className="todo-shell-list">
                {visibleUncompleted.length === 0 && visibleCompleted.length === 0 && (
                  <div className="todo-shell-empty">
                    <CheckCircle2 size={44} />
                    <p>{emptyMessage}</p>
                  </div>
                )}

                {visibleUncompleted.map((todo) => renderTodoCard(todo, "uncompleted"))}

                {visibleCompleted.length > 0 && activeList !== "completed" && (
                  <section
                    className={[
                      "todo-shell-completed-section",
                      shouldPinCompletedToBottom ? "is-pinned-bottom" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div
                      className={`todo-shell-completed-header${visibleCompleted.length > 3 ? " is-expandable" : ""}`}
                      onClick={() => visibleCompleted.length > 3 && setCompletedExpanded((prev) => !prev)}
                    >
                      <span className="todo-shell-completed-header-main">
                        <CheckCircle2 size={14} />
                        <span>已完成 ({visibleCompleted.length})</span>
                      </span>
                      {visibleCompleted.length > 3 && (
                        <span className="todo-shell-completed-toggle">
                          {completedExpanded ? "收起" : `展开 ${Math.min(visibleCompleted.length, 5)} 项`}
                        </span>
                      )}
                    </div>
                    {(completedExpanded
                      ? visibleCompleted.slice(0, 5)
                      : visibleCompleted.slice(0, 3)
                    ).map((todo) => renderTodoCard(todo, "completed"))}
                  </section>
                )}

                {activeList === "completed" &&
                  visibleCompleted.map((todo) => renderTodoCard(todo, "completed-page"))}
              </div>
            </section>
          </div>
        </section>

        <TodoInsightsPanel
          summary={workspaceMeta.summary}
          quickFilters={workspaceMeta.quickFilters}
          activeQuickFilter={activeQuickFilterIndicator}
          onQuickFilterSelect={handleQuickFilterSelect}
          recentCompleted={workspaceMeta.recentCompleted}
          formatDate={formatDate}
        />
      </div>

    </div>
  );
}