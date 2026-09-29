"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CreateTaskForm } from "@/app/cases/[id]/create-task-form";
import { DeleteTaskDialog } from "@/app/cases/[id]/delete-task-dialog";
import { EditTaskForm } from "@/app/cases/[id]/edit-task-form";
import {
  formatTaskDueDate,
  isTaskOverdue,
  taskPriorityLabel,
  taskStatusLabel,
  type CaseTask,
} from "@/lib/tasks-shared";

export function CaseTasksPanel({
  caseId,
  tasks,
  loadError,
  readOnly = false,
}: {
  caseId: number;
  tasks: CaseTask[] | null;
  loadError: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const tasksHeadingRef = useRef<HTMLHeadingElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<{
    task: CaseTask;
    returnFocus: HTMLElement | null;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focusTasksHeading, setFocusTasksHeading] = useState(false);

  function closeDeleteDialog() {
    const returnFocus = deleting?.returnFocus ?? null;
    setDeleting(null);
    queueMicrotask(() => {
      if (returnFocus?.isConnected) {
        returnFocus.focus();
      }
    });
  }

  function handleTaskDeleted(message: string) {
    setDeleting(null);
    setNotice(message);
    setFocusTasksHeading(true);
    router.refresh();
  }

  useEffect(() => {
    if (!focusTasksHeading) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      tasksHeadingRef.current?.focus();
      setFocusTasksHeading(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTasksHeading, tasks]);

  return (
    <section aria-labelledby="case-tasks-heading" className="crm-section flex flex-col gap-4">
      <h2
        id="case-tasks-heading"
        ref={tasksHeadingRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        Tasks
      </h2>

      {notice ? (
        <p role="status" aria-live="polite" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}

      {readOnly ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tasks are read-only while this case is archived.
        </p>
      ) : null}

      {loadError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 px-4 py-6 dark:border-red-900">
          <p role="alert" className="text-red-700 dark:text-red-400">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Try again
          </button>
        </div>
      ) : tasks === null || tasks.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          No tasks for this case yet.
        </p>
      ) : (
        <div className="crm-table-scroll">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Priority
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Due date
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) =>
                !readOnly && editingId === task.id ? (
                  <tr key={task.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td colSpan={5} className="px-4 py-3">
                      <EditTaskForm
                        caseId={caseId}
                        task={task}
                        onCancel={() => setEditingId(null)}
                        onSaved={(message) => {
                          setEditingId(null);
                          setNotice(message);
                          router.refresh();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={task.id} id={`task-${task.id}`} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium break-words">{task.title}</td>
                    <td className="px-4 py-3"><span className="record-status" data-status={task.status}>{taskStatusLabel(task.status)}</span></td>
                    <td className="px-4 py-3">
                      <span className="task-priority-label" data-priority={task.priority}>
                        {taskPriorityLabel(task.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.dueDate ? (
                        <span className="task-due-cell">
                          <time dateTime={task.dueDate}>{formatTaskDueDate(task.dueDate)}</time>
                          {isTaskOverdue(task.dueDate, task.status) ? (
                            <span className="task-overdue-label" aria-label="Overdue">
                              Overdue
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        formatTaskDueDate(null)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {readOnly ? null : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`Edit ${task.title}`}
                            onClick={() => {
                              setNotice(null);
                              setEditingId(task.id);
                            }}
                            className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${task.title}`}
                            onClick={(event) => {
                              setNotice(null);
                              setDeleting({
                                task,
                                returnFocus: event.currentTarget,
                              });
                            }}
                            className="rounded-full border border-red-700 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {loadError || readOnly ? null : (
        <CreateTaskForm
          caseId={caseId}
          onCreated={(message) => {
            setNotice(message);
            router.refresh();
          }}
        />
      )}

      {deleting && !readOnly ? (
        <DeleteTaskDialog
          caseId={caseId}
          task={deleting.task}
          onClose={closeDeleteDialog}
          onDeleted={handleTaskDeleted}
        />
      ) : null}
    </section>
  );
}
