"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateCaseAction } from "@/app/cases/actions";
import { initialCaseFormState } from "@/lib/case-form-state";
import type { CaseStatus, CustomerCase } from "@/lib/cases";

const statuses: Array<{ value: CaseStatus; label: string }> = [
  { value: "Open", label: "Open" },
  { value: "InProgress", label: "In progress" },
  { value: "Closed", label: "Closed" },
];

export function EditCaseForm({
  work,
  customerName,
  onCancel,
  onSaved,
}: {
  work: CustomerCase;
  customerName: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const updateAction = updateCaseAction.bind(null, work.id);
  const [state, formAction, pending] = useActionState(updateAction, initialCaseFormState);
  const [title, setTitle] = useState(work.title);
  const [description, setDescription] = useState(work.description ?? "");
  const [status, setStatus] = useState<CaseStatus>(work.status);
  const reportedRevision = useRef(0);

  useEffect(() => {
    if (state.status !== "success" || reportedRevision.current === state.revision) {
      return;
    }

    reportedRevision.current = state.revision;
    onSaved(state.message ?? `${work.title} was updated.`);
  }, [onSaved, state.message, state.revision, state.status, work.title]);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="edit-case-heading"
      onReset={(event) => event.preventDefault()}
      className="crm-form grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 id="edit-case-heading" className="text-lg font-semibold">
        Edit {work.title}
      </h2>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Customer</span>
        <p className="text-sm">{customerName}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-case-title" className="text-sm font-medium">
          Title
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        </label>
        <input
          id="edit-case-title"
          name="title"
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={pending}
          aria-invalid={state.fieldErrors.title ? true : undefined}
          aria-describedby={state.fieldErrors.title ? "edit-case-title-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
        {state.fieldErrors.title ? (
          <p id="edit-case-title-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.fieldErrors.title}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-case-description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="edit-case-description"
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={pending}
          aria-invalid={state.fieldErrors.description ? true : undefined}
          aria-describedby={state.fieldErrors.description ? "edit-case-description-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
        {state.fieldErrors.description ? (
          <p id="edit-case-description-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.fieldErrors.description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-case-status" className="text-sm font-medium">
          Status
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        </label>
        <select
          id="edit-case-status"
          name="status"
          required
          value={status}
          onChange={(event) => setStatus(event.target.value as CaseStatus)}
          disabled={pending}
          aria-invalid={state.fieldErrors.status ? true : undefined}
          aria-describedby={state.fieldErrors.status ? "edit-case-status-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        >
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors.status ? (
          <p id="edit-case-status-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.fieldErrors.status}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-3">
        {state.formError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.formError}
          </p>
        ) : null}
        <div className="flex gap-2">
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
