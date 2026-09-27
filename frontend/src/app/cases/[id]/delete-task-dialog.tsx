"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteTaskAction } from "@/app/cases/[id]/task-actions";
import { initialDeleteTaskState } from "@/lib/task-form-state";
import type { CaseTask } from "@/lib/tasks-shared";

export function DeleteTaskDialog({
  caseId,
  task,
  onClose,
  onDeleted,
}: {
  caseId: number;
  task: CaseTask;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAction = deleteTaskAction.bind(null, caseId);
  const [state, formAction, pending] = useActionState(boundAction, initialDeleteTaskState);
  const forThisTask = state.taskId === task.id;
  const formError = forThisTask ? state.formError : null;
  const reportedSuccess = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) {
      return;
    }

    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
  }, []);

  useEffect(() => {
    if (!forThisTask || state.status !== "success" || reportedSuccess.current) {
      return;
    }

    reportedSuccess.current = true;
    onDeleted(state.message ?? `${task.title} was deleted.`);
  }, [forThisTask, onDeleted, state.message, state.status, task.title]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-task-title"
      aria-describedby="delete-task-description"
      onCancel={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }

        onClose();
      }}
      className="w-[min(100%,24rem)] rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 shadow-lg backdrop:bg-zinc-950/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <form action={formAction} className="flex flex-col gap-4">
        <h2 id="delete-task-title" className="text-lg font-semibold">
          Delete {task.title}?
        </h2>
        <p id="delete-task-description" className="text-sm text-zinc-600 dark:text-zinc-400">
          This removes {task.title} from this case. The case and other tasks stay unchanged.
        </p>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="title" value={task.title} />
        {formError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {formError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-red-700 px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400 dark:text-red-400"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            data-dialog-cancel
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
