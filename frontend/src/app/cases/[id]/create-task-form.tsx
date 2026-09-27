"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { createTaskAction } from "@/app/cases/[id]/task-actions";
import { initialTaskFormState } from "@/lib/task-form-state";

export function CreateTaskForm({
  caseId,
  onCreated,
}: {
  caseId: number;
  onCreated: (message: string) => void;
}) {
  const boundAction = createTaskAction.bind(null, caseId);
  const [state, formAction, pending] = useActionState(boundAction, initialTaskFormState);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clearedRevision, setClearedRevision] = useState(state.revision);
  const reportedRevision = useRef(0);

  if (state.status === "success" && state.revision !== clearedRevision) {
    setClearedRevision(state.revision);
    setTitle("");
    setDescription("");
    setDueDate("");
  }

  useEffect(() => {
    if (state.status !== "success" || reportedRevision.current === state.revision) {
      return;
    }

    reportedRevision.current = state.revision;
    onCreated(state.message ?? "Task was added.");
  }, [onCreated, state.message, state.revision, state.status]);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="add-task-heading"
      onReset={(event) => event.preventDefault()}
      className="crm-form grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-1">
        <h3 id="add-task-heading" className="text-base font-semibold">
          Add task
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">New tasks start as To do.</p>
      </div>
      <Field id="task-title" label="Title" required error={state.fieldErrors.title}>
        <input
          id="task-title"
          name="title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={pending}
          aria-invalid={state.fieldErrors.title ? true : undefined}
          aria-describedby={state.fieldErrors.title ? "task-title-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </Field>
      <Field id="task-description" label="Description" required={false} error={state.fieldErrors.description}>
        <textarea
          id="task-description"
          name="description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={pending}
          aria-invalid={state.fieldErrors.description ? true : undefined}
          aria-describedby={state.fieldErrors.description ? "task-description-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </Field>
      <Field id="task-due-date" label="Due date" required={false} error={state.fieldErrors.dueDate}>
        <input
          id="task-due-date"
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          disabled={pending}
          aria-invalid={state.fieldErrors.dueDate ? true : undefined}
          aria-describedby={state.fieldErrors.dueDate ? "task-due-date-error" : undefined}
          className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </Field>
      <div className="flex flex-col items-start gap-3">
        {state.formError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
