"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { createCustomerNoteAction } from "@/app/customers/[id]/customer-note-actions";
import { initialCustomerNoteFormState } from "@/lib/customer-note-form-state";
import { CUSTOMER_NOTE_MAX_LENGTH } from "@/lib/customer-notes-shared";

export function CreateCustomerNoteForm({
  customerId,
  onCreated,
}: {
  customerId: number;
  onCreated: (message: string) => void;
}) {
  const boundAction = createCustomerNoteAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialCustomerNoteFormState,
  );
  const [content, setContent] = useState("");
  const [clearedRevision, setClearedRevision] = useState(state.revision);
  const reportedRevision = useRef(0);

  if (state.status === "success" && state.revision !== clearedRevision) {
    setClearedRevision(state.revision);
    setContent("");
  }

  useEffect(() => {
    if (state.status !== "success" || reportedRevision.current === state.revision) {
      return;
    }

    reportedRevision.current = state.revision;
    onCreated(state.message ?? "Note was added.");
  }, [onCreated, state.message, state.revision, state.status]);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="add-note-heading"
      onReset={(event) => event.preventDefault()}
      className="crm-form grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-1">
        <h3 id="add-note-heading" className="text-base font-semibold">
          Add note
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Plain text only. Maximum {CUSTOMER_NOTE_MAX_LENGTH.toLocaleString()} characters.
        </p>
      </div>
      <Field id="note-content" label="Note" required error={state.fieldErrors.content}>
        <textarea
          id="note-content"
          name="content"
          rows={4}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={pending}
          maxLength={CUSTOMER_NOTE_MAX_LENGTH}
          aria-invalid={state.fieldErrors.content ? true : undefined}
          aria-describedby={state.fieldErrors.content ? "note-content-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
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
          {pending ? "Saving…" : "Add note"}
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
        {required ? null : (
          <span className="font-normal text-zinc-500"> (optional)</span>
        )}
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
