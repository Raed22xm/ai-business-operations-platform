"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTaskAction } from "@/app/cases/[id]/task-actions";
import { initialTaskFormState } from "@/lib/task-form-state";
import {
  taskPriorityLabel,
  taskStatusLabel,
  type CaseTask,
  type TaskPriority,
} from "@/lib/tasks-shared";

const statuses: Array<{ value: "Todo" | "InProgress" | "Done"; label: string }> = [
  { value: "Todo", label: taskStatusLabel("Todo") },
  { value: "InProgress", label: taskStatusLabel("InProgress") },
  { value: "Done", label: taskStatusLabel("Done") },
];

const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: "Low", label: taskPriorityLabel("Low") },
  { value: "Normal", label: taskPriorityLabel("Normal") },
  { value: "High", label: taskPriorityLabel("High") },
];

export function EditTaskForm({
  caseId,
  task,
  onCancel,
  onSaved,
}: {
  caseId: number;
  task: CaseTask;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const boundAction = updateTaskAction.bind(null, caseId, task.id);
  const [state, formAction, pending] = useActionState(boundAction, initialTaskFormState);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [status, setStatus] = useState<"Todo" | "InProgress" | "Done">(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const reportedRevision = useRef(0);

  useEffect(() => {
    if (state.status !== "success" || reportedRevision.current === state.revision) {
      return;
    }

    reportedRevision.current = state.revision;
    onSaved(state.message ?? `${task.title} was updated.`);
  }, [onSaved, state.message, state.revision, state.status, task.title]);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby={`edit-task-heading-${task.id}`}
      onReset={(event) => event.preventDefault()}
      className="crm-form grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h3 id={`edit-task-heading-${task.id}`} className="text-base font-semibold">
        Edit {task.title}
      </h3>
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-task-title-${task.id}`} className="text-sm font-medium">
          Title
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        </label>
        <input
          id={`edit-task-title-${task.id}`}
          name="title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={pending}
          aria-invalid={state.fieldErrors.title ? true : undefined}
          aria-describedby={
            state.fieldErrors.title ? `edit-task-title-error-${task.id}` : undefined
          }
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
        {state.fieldErrors.title ? (
          <p
            id={`edit-task-title-error-${task.id}`}
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.title}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-task-description-${task.id}`} className="text-sm font-medium">
          Description
        </label>
        <textarea
          id={`edit-task-description-${task.id}`}
          name="description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={pending}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-task-due-date-${task.id}`} className="text-sm font-medium">
          Due date
        </label>
        <input
          id={`edit-task-due-date-${task.id}`}
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          disabled={pending}
          className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-task-status-${task.id}`} className="text-sm font-medium">
          Status
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        </label>
        <select
          id={`edit-task-status-${task.id}`}
          name="status"
          required
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "Todo" | "InProgress" | "Done")
          }
          disabled={pending}
          aria-invalid={state.fieldErrors.status ? true : undefined}
          aria-describedby={
            state.fieldErrors.status ? `edit-task-status-error-${task.id}` : undefined
          }
          className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        >
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors.status ? (
          <p
            id={`edit-task-status-error-${task.id}`}
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.status}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-task-priority-${task.id}`} className="text-sm font-medium">
          Priority
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        </label>
        <select
          id={`edit-task-priority-${task.id}`}
          name="priority"
          required
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
          disabled={pending}
          aria-invalid={state.fieldErrors.priority ? true : undefined}
          aria-describedby={
            state.fieldErrors.priority ? `edit-task-priority-error-${task.id}` : undefined
          }
          className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        >
          {priorities.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors.priority ? (
          <p
            id={`edit-task-priority-error-${task.id}`}
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.priority}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-3">
        {state.formError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
