"use client";

import { useOptimistic, useTransition, useState } from "react";
import type { TaskStatus } from "@/lib/tasks-shared";
import { updateTaskStatusAction } from "@/app/tasks/task-workspace-actions";

export function TaskStatusSelector({
  taskId,
  initialStatus,
  taskTitle,
}: {
  taskId: number;
  initialStatus: TaskStatus;
  taskTitle: string;
}) {
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    status,
    (_current, next: TaskStatus) => next,
  );

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = e.target.value as TaskStatus;
    if (nextStatus === status) return;

    setError(null);
    setJustSaved(false);
    startTransition(async () => {
      setOptimisticStatus(nextStatus);
      const result = await updateTaskStatusAction(taskId, nextStatus);
      if (result.status === "error") {
        setError(result.message);
        setOptimisticStatus(status);
      } else {
        setStatus(nextStatus);
        setJustSaved(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("task-status-updated"));
        }
      }
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <label htmlFor={`task-status-${taskId}`} className="sr-only">
        Update status for {taskTitle}
      </label>
      <select
        id={`task-status-${taskId}`}
        value={optimisticStatus}
        onChange={handleChange}
        disabled={isPending}
        data-status={optimisticStatus}
        className="record-status cursor-pointer appearance-none pr-6 bg-no-repeat focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-70 transition-colors"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
          backgroundPosition: `right 4px center`,
          backgroundSize: `16px 16px`,
        }}
        aria-label={`Status for task ${taskTitle}`}
        data-saved={justSaved ? "true" : undefined}
      >
        <option value="Todo" className="bg-zinc-900 text-zinc-100">
          Todo
        </option>
        <option value="InProgress" className="bg-zinc-900 text-zinc-100">
          In progress
        </option>
        <option value="Done" className="bg-zinc-900 text-zinc-100">
          Done
        </option>
      </select>
      {isPending && (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent"
          aria-label="Updating status..."
        />
      )}
      {justSaved && !isPending && (
        <span
          className="text-[11px] text-emerald-400 font-medium"
          aria-label="Status saved"
        >
          Saved
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="text-xs text-red-400"
          title={error}
        >
          Failed
        </span>
      )}
    </div>
  );
}
