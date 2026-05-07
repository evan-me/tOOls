import React from "react";

export default function TodoHero({
  title,
  summary,
  activeListLabel,
  hasActiveFilters,
  onResetFilters,
  onCreateTodo,
}) {
  return (
    <section className="todo-workbench-hero">
      <div className="todo-workbench-hero-copy">
        <span className="todo-workbench-hero-eyebrow">Todo Workbench</span>
        <h1>{title}</h1>
        <p>
          {summary.total} 项任务中已完成 <strong>{summary.done}</strong> 项，
          {summary.focusLabel}。
          <span className="todo-workbench-hero-context">当前视图：{activeListLabel}</span>
        </p>
      </div>
      <div className="todo-workbench-hero-actions">
        <button type="button" className="todo-workbench-btn" onClick={onResetFilters}>
          {hasActiveFilters ? "清空当前筛选" : "回到默认视图"}
        </button>
        <button type="button" className="todo-workbench-btn is-primary" onClick={onCreateTodo}>
          + 新建任务
        </button>
      </div>
    </section>
  );
}