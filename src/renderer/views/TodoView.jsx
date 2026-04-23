import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  ListTodo,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Circle,
  CheckCircle,
  FolderPlus,
  X,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const BUILTIN_LISTS = [
  { id: "all", name: "全部任务", icon: List, builtIn: true },
  { id: "today", name: "今天", icon: Calendar, builtIn: true },
  { id: "completed", name: "已完成", icon: CheckCircle2, builtIn: true },
];

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return `今天 ${timeStr}`;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  ) {
    return `明天 ${timeStr}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
}

export default function TodoView() {
  const [lists, setLists] = useState([]);
  const [activeList, setActiveList] = useState("all");
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calSelectedDate, setCalSelectedDate] = useState(null);
  const [calCollapsed, setCalCollapsed] = useState(true);
  const [allTodos, setAllTodos] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [renamingListId, setRenamingListId] = useState(null);
  const [renamingListName, setRenamingListName] = useState("");
  const inputRef = useRef(null);
  const editInputRef = useRef(null);
  const newListInputRef = useRef(null);
  const renamingListInputRef = useRef(null);

  const loadLists = useCallback(async () => {
    const data = await window.api.getTodoLists();
    setLists(data);
  }, []);

  const loadTodos = useCallback(async () => {
    const data = await window.api.getTodos(activeList);
    setTodos(data);
  }, [activeList]);

  const loadAllTodos = useCallback(async () => {
    const data = await window.api.getTodos("all");
    setAllTodos(data);
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    loadTodos();
    loadAllTodos();
  }, [loadTodos, loadAllTodos]);

  useEffect(() => {
    if (showNewList && newListInputRef.current) {
      newListInputRef.current.focus();
    }
  }, [showNewList]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (renamingListId && renamingListInputRef.current) {
      renamingListInputRef.current.focus();
      renamingListInputRef.current.select();
    }
  }, [renamingListId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [contextMenu]);

  async function handleAddTodo(e) {
    e.preventDefault();
    const text = newTodo.trim();
    if (!text) return;
    await window.api.addTodo(text, activeList);
    setNewTodo("");
    loadTodos();
    loadAllTodos();
  }

  async function handleToggle(id) {
    await window.api.toggleTodo(id);
    loadTodos();
    loadAllTodos();
  }

  async function handleDelete(id) {
    await window.api.deleteTodo(id);
    loadTodos();
    loadAllTodos();
  }

  function handleStartEdit(todo) {
    setEditingId(todo.id);
    setEditText(todo.title);
  }

  async function handleSaveEdit(id) {
    const text = editText.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    await window.api.updateTodo(id, text);
    setEditingId(null);
    loadTodos();
    loadAllTodos();
  }

  async function handleAddList(e) {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    const updated = await window.api.addTodoList(name);
    setLists(updated);
    setNewListName("");
    setShowNewList(false);
  }

  async function handleDeleteList(id) {
    if (!confirm("删除此列表？列表中的待办也会被删除。")) return;
    const updated = await window.api.deleteTodoList(id);
    setLists(updated);
    if (activeList === String(id)) {
      setActiveList("all");
    }
    loadLists();
    loadAllTodos();
  }

  async function handleRenameList(id) {
    const name = renamingListName.trim();
    setRenamingListId(null);
    if (!name) return;
    await window.api.renameTodoList(id, name);
    loadLists();
  }

  const pendingCount = (listId) => {
    // 简单返回空，实际可按需查询
    return "";
  };

  const activeListObj =
    BUILTIN_LISTS.find((l) => l.id === activeList) ||
    lists.find((l) => String(l.id) === activeList);
  const activeListLabel = activeListObj
    ? activeListObj.name || activeListObj.label
    : "全部任务";

  const filteredTodos = calSelectedDate
    ? todos.filter((t) => {
        const d = new Date(t.created_at);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return ds === calSelectedDate;
      })
    : todos;
  const uncompleted = filteredTodos.filter((t) => !t.completed);
  const completed = filteredTodos.filter((t) => t.completed);
  const showCompleted = activeList === "completed" || completed.length > 0;

  // ---- 月历计算 ----
  const datesWithTodos = useMemo(() => {
    const s = new Set();
    allTodos
      .filter((t) => !t.completed)
      .forEach((t) => {
        const d = new Date(t.created_at);
        s.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        );
      });
    return s;
  }, [allTodos]);

  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const calPrevDays = new Date(calYear, calMonth, 0).getDate();
  const calCells = [];
  // 上月补位
  for (let i = 0; i < calFirstDayOfWeek; i++) {
    calCells.push({
      day: calPrevDays - calFirstDayOfWeek + 1 + i,
      currentMonth: false,
      date: null,
    });
  }
  // 本月
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  for (let d = 1; d <= calDaysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calCells.push({
      day: d,
      currentMonth: true,
      date: dateStr,
      isToday: dateStr === todayStr,
      hasTodo: datesWithTodos.has(dateStr),
      isSelected: dateStr === calSelectedDate,
    });
  }
  // 下月补位
  const remaining = 7 - (calCells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      calCells.push({ day: i, currentMonth: false, date: null });
    }
  }

  function calPrev() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  }

  function calNext() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  }

  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div
      className="view-container"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 0,
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* 月历 - 卡片样式 */}
      <div className="calendarWrap-responsive" style={styles.calendarWrap}>
        {calCollapsed ? (
          <div
            className="cal-collapsed-bar"
            style={styles.calCollapsedBar}
            onClick={(e) => {
              e.stopPropagation();
              setCalCollapsed(false);
            }}
          >
            <Calendar size={14} style={{ color: "#888", flexShrink: 0 }} />
            <span style={styles.calCollapsedText}>
              {(() => {
                const _t = new Date();
                const _wd = ["日", "一", "二", "三", "四", "五", "六"][
                  _t.getDay()
                ];
                const _todayStr = `${_t.getFullYear()}年${_t.getMonth() + 1}月${_t.getDate()}日 周${_wd}`;
                if (calSelectedDate) {
                  return calSelectedDate.replace(
                    /^(\d{4})-(\d{2})-(\d{2})$/,
                    "$1年$2月$3日",
                  );
                }
                return _todayStr;
              })()}
            </span>
            {calSelectedDate && (
              <button
                style={styles.calCollapsedClear}
                onClick={(e) => {
                  e.stopPropagation();
                  setCalSelectedDate(null);
                }}
              >
                <X size={12} />
              </button>
            )}
            <ChevronRight size={14} style={{ color: "#bbb", flexShrink: 0 }} />
          </div>
        ) : (
          <>
            <div style={styles.calHeader}>
              <button style={styles.calNav} onClick={calPrev}>
                <ChevronLeft size={16} />
              </button>
              <span
                style={{ ...styles.calTitle, cursor: "pointer" }}
                onClick={() => setCalCollapsed(true)}
                title="点击收缩日历"
              >
                {calYear}年{calMonth + 1}月
              </span>
              <button style={styles.calNav} onClick={calNext}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div style={styles.calWeekdays}>
              {WEEKDAYS.map((w) => (
                <div key={w} style={styles.calWeekday}>
                  {w}
                </div>
              ))}
            </div>
            <div style={styles.calGrid}>
              {calCells.map((cell, i) => (
                <div
                  key={i}
                  className="calDay-responsive"
                  style={{
                    ...styles.calDay,
                    ...(cell.currentMonth ? {} : styles.calDayOutside),
                    ...(cell.isToday ? styles.calDayToday : {}),
                    ...(cell.isSelected ? styles.calDaySelected : {}),
                    cursor: cell.date ? "pointer" : "default",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    cell.date &&
                      setCalSelectedDate(
                        cell.date === calSelectedDate ? null : cell.date,
                      );
                  }}
                >
                  <span>{cell.day}</span>
                  {cell.hasTodo && <span style={styles.calDot} />}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 下方区域：左侧列表 + 右侧任务 */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          borderTop: "1px solid #f0f0f0",
        }}
      >
        {/* 左侧列表 */}
        <div className="todo-sidebar-responsive" style={styles.sidebar}>
          <div style={styles.sidebarList}>
            {BUILTIN_LISTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.sidebarItem,
                    ...(activeList === item.id ? styles.sidebarItemActive : {}),
                  }}
                  onClick={() => setActiveList(item.id)}
                >
                  <Icon size={15} style={{ marginRight: 8, flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </span>
                  {item.id === "completed" && completed.length > 0 && (
                    <span style={styles.badge}>{completed.length}</span>
                  )}
                </div>
              );
            })}

            {/* 自定义列表 */}
            {lists.map((item) => (
              <div
                key={item.id}
                style={{
                  ...styles.sidebarItem,
                  ...(activeList === String(item.id)
                    ? styles.sidebarItemActive
                    : {}),
                }}
                onClick={() => setActiveList(String(item.id))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    listId: item.id,
                    listName: item.name,
                  });
                }}
              >
                <List size={15} style={{ marginRight: 8, flexShrink: 0 }} />
                {renamingListId === item.id ? (
                  <input
                    ref={renamingListInputRef}
                    style={styles.renameInput}
                    value={renamingListName}
                    onChange={(e) => setRenamingListName(e.target.value)}
                    onBlur={() => handleRenameList(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameList(item.id);
                      if (e.key === "Escape") setRenamingListId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* 新建列表 */}
          {showNewList ? (
            <form onSubmit={handleAddList} style={styles.newListForm}>
              <input
                ref={newListInputRef}
                style={styles.newListInput}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="列表名称"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowNewList(false);
                    setNewListName("");
                  }
                }}
              />
              <div style={{ display: "flex", gap: 4 }}>
                <button type="submit" style={styles.newListConfirm}>
                  添加
                </button>
                <button
                  type="button"
                  style={styles.newListCancel}
                  onClick={() => {
                    setShowNewList(false);
                    setNewListName("");
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          ) : (
            <button
              style={styles.addListBtn}
              onClick={() => setShowNewList(true)}
            >
              <FolderPlus size={14} style={{ marginRight: 6 }} />
              新建列表
            </button>
          )}
        </div>

        {/* 右侧任务区 */}
        <div style={styles.main}>
          <div style={styles.mainHeader}>
            <h2 style={styles.mainTitle}>
              {activeListLabel}
              {calSelectedDate && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#999",
                    marginLeft: 8,
                  }}
                >
                  ·{" "}
                  {calSelectedDate.replace(
                    /^(\d{4})-(\d{2})-(\d{2})$/,
                    "$1年$2月$3日",
                  )}
                </span>
              )}
            </h2>
            <span style={styles.countLabel}>
              {calSelectedDate ? `${filteredTodos.length} 项 / ` : ""}
              {uncompleted.length} 个待办
              {calSelectedDate && (
                <span
                  style={{
                    marginLeft: 8,
                    color: "#3b82f6",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                  onClick={() => setCalSelectedDate(null)}
                >
                  取消筛选
                </span>
              )}
            </span>
          </div>

          {/* 添加任务 */}
          <form onSubmit={handleAddTodo} style={styles.addForm}>
            <Plus size={18} style={{ color: "#999", flexShrink: 0 }} />
            <input
              ref={inputRef}
              style={styles.addInput}
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder={
                calSelectedDate
                  ? `添加到 ${calSelectedDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日")}`
                  : "添加待办事项"
              }
            />
          </form>

          {/* 未完成任务 */}
          <div style={styles.todoList}>
            {uncompleted.length === 0 && completed.length === 0 && (
              <div style={styles.empty}>
                <CheckCircle2
                  size={48}
                  style={{ color: "#ddd", marginBottom: 12 }}
                />
                <p style={{ color: "#999", fontSize: 14 }}>暂无待办事项</p>
              </div>
            )}

            {uncompleted.map((todo) => (
              <div key={todo.id} className="todo-card" style={styles.todoItem}>
                <button
                  style={styles.checkbox}
                  onClick={() => handleToggle(todo.id)}
                  title="标记完成"
                >
                  <Circle size={20} />
                </button>

                {editingId === todo.id ? (
                  <input
                    ref={editInputRef}
                    style={styles.editInput}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => handleSaveEdit(todo.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(todo.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <div
                    style={styles.todoContent}
                    onDoubleClick={() => handleStartEdit(todo)}
                  >
                    <span style={styles.todoTitle}>{todo.title}</span>
                    <div style={styles.todoMeta}>
                      <span>{formatDate(todo.created_at)}</span>
                      {todo.list_name && (
                        <span style={styles.listTag}>{todo.list_name}</span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(todo.id)}
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {/* 已完成任务折叠区 */}
            {completed.length > 0 && activeList !== "completed" && (
              <div style={styles.completedSection}>
                <div style={styles.completedHeader}>
                  <CheckCircle2 size={14} style={{ marginRight: 6 }} />
                  已完成 ({completed.length})
                </div>
                {completed.map((todo) => (
                  <div
                    key={todo.id}
                    className="todo-card"
                    style={{ ...styles.todoItem, opacity: 0.55 }}
                  >
                    <button
                      style={{ ...styles.checkbox, color: "#4caf50" }}
                      onClick={() => handleToggle(todo.id)}
                      title="标记未完成"
                    >
                      <CheckCircle size={20} />
                    </button>
                    <div style={styles.todoContent}>
                      <span
                        style={{
                          ...styles.todoTitle,
                          textDecoration: "line-through",
                          color: "#999",
                        }}
                      >
                        {todo.title}
                      </span>
                    </div>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(todo.id)}
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 已完成页面的全部列表 */}
            {activeList === "completed" &&
              completed.map((todo) => (
                <div
                  key={todo.id}
                  className="todo-card"
                  style={styles.todoItem}
                >
                  <button
                    style={{ ...styles.checkbox, color: "#4caf50" }}
                    onClick={() => handleToggle(todo.id)}
                    title="标记未完成"
                  >
                    <CheckCircle size={20} />
                  </button>
                  <div style={styles.todoContent}>
                    <span
                      style={{
                        ...styles.todoTitle,
                        textDecoration: "line-through",
                        color: "#999",
                      }}
                    >
                      {todo.title}
                    </span>
                    <div style={styles.todoMeta}>
                      <span>
                        {formatDate(todo.completed_at || todo.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    style={styles.deleteBtn}
                    onClick={() => handleDelete(todo.id)}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          style={{
            ...styles.contextMenu,
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={styles.contextMenuItem}
            onClick={() => {
              setRenamingListId(contextMenu.listId);
              setRenamingListName(contextMenu.listName);
              setContextMenu(null);
            }}
          >
            改名
          </div>
          <div
            style={{ ...styles.contextMenuItem, color: "#dc2626" }}
            onClick={() => {
              handleDeleteList(contextMenu.listId);
              setContextMenu(null);
            }}
          >
            删除
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  sidebar: {
    width: 220,
    minWidth: 220,
    background: "#fafafa",
    borderRight: "1px solid #eaeaea",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    padding: "18px 16px 14px",
    color: "#1a1a1a",
  },
  sidebarList: {
    flex: 1,
    overflowY: "auto",
    padding: "0 8px",
  },
  sidebarItem: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    color: "#444",
    marginBottom: 2,
    transition: "all 0.1s",
    userSelect: "none",
  },
  sidebarItemActive: {
    background: "#e8e8e8",
    color: "#1a1a1a",
    fontWeight: 500,
  },
  badge: {
    background: "#ddd",
    color: "#666",
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 10,
    marginLeft: 4,
  },
  deleteListBtn: {
    background: "none",
    border: "none",
    color: "#bbb",
    cursor: "pointer",
    padding: 2,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    opacity: 0,
    transition: "opacity 0.1s",
  },
  addListBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 16px",
    background: "none",
    border: "none",
    borderTop: "1px solid #eee",
    color: "#888",
    cursor: "pointer",
    fontSize: 13,
    transition: "color 0.1s",
  },
  newListForm: {
    padding: "8px 12px",
    borderTop: "1px solid #eee",
  },
  newListInput: {
    width: "100%",
    padding: "6px 10px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 13,
    outline: "none",
    marginBottom: 6,
  },
  newListConfirm: {
    padding: "4px 12px",
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    fontSize: 12,
    cursor: "pointer",
  },
  newListCancel: {
    padding: "4px 12px",
    background: "#f0f0f0",
    color: "#666",
    border: "none",
    borderRadius: 5,
    fontSize: 12,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  mainHeader: {
    display: "flex",
    alignItems: "baseline",
    padding: "20px 24px 12px",
    gap: 10,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: "#1a1a1a",
    margin: 0,
  },
  countLabel: {
    fontSize: 12,
    color: "#aaa",
  },
  addForm: {
    display: "flex",
    alignItems: "center",
    margin: "0 24px 16px",
    padding: "12px 16px",
    background: "#ffffff",
    border: "1px solid #eaeaea",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    gap: 10,
  },
  addInput: {
    flex: 1,
    border: "none",
    background: "none",
    outline: "none",
    fontSize: 14,
    color: "#333",
  },
  todoList: {
    flex: 1,
    overflowY: "auto",
    padding: "0 24px 16px",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 0",
  },
  todoItem: {
    display: "flex",
    alignItems: "flex-start",
    padding: "12px 16px",
    borderRadius: 12,
    marginBottom: 8,
    background: "#ffffff",
    border: "1px solid #eaeaea",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    transition: "background 0.1s, box-shadow 0.1s",
  },
  checkbox: {
    background: "none",
    border: "none",
    color: "#ccc",
    cursor: "pointer",
    padding: 0,
    marginRight: 10,
    marginTop: 1,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  todoContent: {
    flex: 1,
    minWidth: 0,
  },
  todoTitle: {
    fontSize: 14,
    color: "#1a1a1a",
    lineHeight: 1.4,
    display: "block",
    wordBreak: "break-word",
  },
  todoMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
    fontSize: 11,
    color: "#bbb",
  },
  listTag: {
    background: "#f0f0f0",
    padding: "1px 6px",
    borderRadius: 4,
    fontSize: 10,
  },
  editInput: {
    flex: 1,
    border: "1px solid #ccc",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 14,
    outline: "none",
    marginRight: 8,
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#ccc",
    cursor: "pointer",
    padding: 4,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    opacity: 1,
    transition: "opacity 0.1s",
  },
  renameInput: {
    flex: 1,
    border: "1px solid #3b82f6",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 13,
    outline: "none",
    background: "#fff",
  },
  contextMenu: {
    position: "fixed",
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    padding: "4px 0",
    zIndex: 1000,
    minWidth: 120,
  },
  contextMenuItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    fontSize: 13,
    color: "#333",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  completedSection: {
    marginTop: 12,
    borderTop: "1px solid #eaeaea",
    paddingTop: 12,
  },
  completedHeader: {
    display: "flex",
    alignItems: "center",
    fontSize: 12,
    color: "#aaa",
    padding: "4px 12px",
    marginBottom: 4,
  },
  calendarWrap: {
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: 12,
    margin: "12px 16px 16px",
    padding: "12px 16px",
    flexShrink: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  calHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calNav: {
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  calTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#333",
  },
  calWeekdays: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    marginBottom: 2,
  },
  calWeekday: {
    textAlign: "center",
    fontSize: 11,
    color: "#aaa",
    padding: "2px 0",
  },
  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 1,
  },
  calDay: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    borderRadius: 6,
    fontSize: 12,
    color: "#333",
    userSelect: "none",
  },
  calDayOutside: {
    color: "#ccc",
  },
  calDayToday: {
    fontWeight: 700,
    color: "#1a1a1a",
    background: "#e8e8e8",
  },
  calDaySelected: {
    background: "#1a1a1a",
    color: "#fff",
  },
  calDot: {
    position: "absolute",
    bottom: 2,
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#3b82f6",
  },
  calCollapsedBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    cursor: "pointer",
    borderRadius: 8,
    transition: "background 0.1s",
    userSelect: "none",
  },
  calCollapsedText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  calCollapsedSelected: {
    fontWeight: 400,
    color: "#888",
    marginLeft: 4,
  },
  calCollapsedClear: {
    background: "none",
    border: "none",
    color: "#bbb",
    cursor: "pointer",
    padding: 2,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    transition: "color 0.1s",
  },
};
