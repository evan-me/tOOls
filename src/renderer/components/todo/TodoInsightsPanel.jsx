import React from "react";

export default function TodoInsightsPanel({
  summary,
  quickFilters,
  activeQuickFilter,
  onQuickFilterSelect,
  recentCompleted,
  formatDate,
}) {
  return (
    <aside className="todo-workbench-insights">
      <section className="todo-workbench-card">
        <h3>
          今日进度 <span>Live</span>
        </h3>
        <div className="todo-workbench-kpi-row">
          <div className="todo-workbench-kpi">
            <span>完成</span>
            <strong>{summary.done}</strong>
          </div>
          <div className="todo-workbench-kpi">
            <span>剩余</span>
            <strong>{summary.active}</strong>
          </div>
          <div className="todo-workbench-kpi">
            <span>完成率</span>
            <strong>{summary.completionRate}%</strong>
          </div>
        </div>
      </section>

      <section className="todo-workbench-card">
        <h3>
          快捷筛选 <span>Quick</span>
        </h3>
        <div className="todo-workbench-quick-list">
          {quickFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`todo-workbench-quick-btn ${activeQuickFilter === filter.id ? "is-active" : ""}`}
              onClick={() => onQuickFilterSelect(filter.id)}
            >
              <span>{filter.label}</span>
              <strong>{filter.count}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="todo-workbench-card">
        <h3>
          最近完成 <span>Log</span>
        </h3>
        <ul className="todo-workbench-done-list">
          {recentCompleted.length === 0 && <li className="todo-workbench-empty-log">暂无完成记录</li>}
          {recentCompleted.map((todo) => (
            <li key={todo.id} className="todo-workbench-done-item">
              <div>
                <span>{todo.title}</span>
                {todo.list_name && <small>{todo.list_name}</small>}
              </div>
              <time>{formatDate(todo.completed_at || todo.created_at)}</time>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}