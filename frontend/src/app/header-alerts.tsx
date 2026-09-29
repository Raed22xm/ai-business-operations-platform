"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
} from "lucide-react";
import {
  getUrgentTasksAlertAction,
  type UrgentTasksAlertData,
} from "@/app/header-alerts-actions";

type HeaderAlertsProps = {
  onCountsLoaded?: (counts: { overdue: number; dueToday: number } | null) => void;
};

export function HeaderAlerts({ onCountsLoaded }: HeaderAlertsProps) {
  const pathname = usePathname();
  const [data, setData] = useState<UrgentTasksAlertData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const result = await getUrgentTasksAlertAction();
      setData(result);
      if (onCountsLoaded) {
        onCountsLoaded(
          result ? { overdue: result.overdueTasks, dueToday: result.dueTodayTasks } : null,
        );
      }
    } catch {
      // Ignore background fetch errors
    }
  }, [onCountsLoaded]);

  // Fetch on mount, on route changes, and on window focus
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts, pathname]);

  // Listen for task status change events dispatched from task components
  useEffect(() => {
    function handleTaskUpdate() {
      fetchAlerts();
    }
    window.addEventListener("task-status-updated", handleTaskUpdate);
    return () => {
      window.removeEventListener("task-status-updated", handleTaskUpdate);
    };
  }, [fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const urgentCount = data?.urgentCount ?? 0;
  const overdueTasks = data?.overdueTasks ?? 0;
  const dueTodayTasks = data?.dueTodayTasks ?? 0;

  const label =
    urgentCount > 0
      ? `${urgentCount} urgent tasks: ${overdueTasks} overdue, ${dueTodayTasks} due today`
      : "No urgent tasks";

  return (
    <div className="header-alerts-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`icon-button header-alerts-trigger${isOpen ? " is-active" : ""}`}
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        title={label}
      >
        <Bell size={18} aria-hidden="true" />
        {urgentCount > 0 && (
          <span
            className={`alerts-badge ${overdueTasks > 0 ? "is-overdue" : "is-today"}`}
            aria-hidden="true"
          >
            {urgentCount > 9 ? "9+" : urgentCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="workspace-popover alerts-popover"
          role="dialog"
          aria-label="Due-date alerts"
        >
          <div className="alerts-popover-header">
            <div className="alerts-popover-title-row">
              <span className="alerts-popover-title">Due-Date Alerts</span>
              {urgentCount > 0 ? (
                <span className={`alerts-header-pill ${overdueTasks > 0 ? "is-urgent" : "is-amber"}`}>
                  {urgentCount} urgent
                </span>
              ) : (
                <span className="alerts-header-pill is-calm">Up to date</span>
              )}
            </div>
            <p className="alerts-popover-subtitle">
              {urgentCount > 0
                ? "Immediate task priorities across your workspace."
                : "All tasks are on track. No overdue items."}
            </p>
          </div>

          <div className="alerts-quick-filters">
            <Link
              href="/tasks?due=overdue"
              className="alerts-filter-card is-overdue"
              onClick={() => setIsOpen(false)}
            >
              <div className="alerts-card-top">
                <span className="alerts-dot is-red" aria-hidden="true" />
                <span className="alerts-card-label">Overdue</span>
              </div>
              <span className="alerts-card-count">{overdueTasks}</span>
            </Link>

            <Link
              href="/tasks?due=today"
              className="alerts-filter-card is-today"
              onClick={() => setIsOpen(false)}
            >
              <div className="alerts-card-top">
                <span className="alerts-dot is-amber" aria-hidden="true" />
                <span className="alerts-card-label">Due today</span>
              </div>
              <span className="alerts-card-count">{dueTodayTasks}</span>
            </Link>
          </div>

          {data && data.items.length > 0 ? (
            <div className="alerts-items-section">
              <div className="alerts-section-title">Urgent Tasks</div>
              <ul className="alerts-items-list">
                {data.items.map((item) => (
                  <li key={item.id} className="alerts-item-row">
                    <Link
                      href={`/cases/${item.caseId}`}
                      className="alerts-item-link"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="alerts-item-info">
                        <span className="alerts-item-title">{item.title}</span>
                        <span className="alerts-item-case">{item.caseTitle}</span>
                      </div>
                      <div className="alerts-item-tag-wrapper">
                        {item.isOverdue ? (
                          <span className="alerts-tag is-overdue">Overdue</span>
                        ) : (
                          <span className="alerts-tag is-today">Due today</span>
                        )}
                        <ChevronRight size={13} className="alerts-chevron" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="alerts-empty-state">
              <CheckCircle2 size={24} className="alerts-empty-icon" />
              <span>All tasks are completed or up to date!</span>
            </div>
          )}

          <div className="alerts-popover-footer">
            <Link
              href="/tasks"
              className="alerts-footer-link"
              onClick={() => setIsOpen(false)}
            >
              <span>View all tasks</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
