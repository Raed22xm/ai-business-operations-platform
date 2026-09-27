"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { updateCustomerNoteAction } from "@/app/customers/[id]/customer-note-actions";
import { initialCustomerNoteFormState } from "@/lib/customer-note-form-state";
import {
  CUSTOMER_NOTE_MAX_LENGTH,
  type CustomerNote,
} from "@/lib/customer-notes-shared";

export function EditCustomerNoteForm({
  customerId,
  note,
  onCancel,
  onSaved,
}: {
  customerId: number;
  note: CustomerNote;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const boundAction = updateCustomerNoteAction.bind(null, customerId, note.id);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialCustomerNoteFormState,
  );
  const [content, setContent] = useState(note.content);
  const reportedRevision = useRef(0);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.status !== "success" || reportedRevision.current === state.revision) {
      return;
    }

    reportedRevision.current = state.revision;
    onSaved(state.message ?? "Note was updated.");
  }, [onSaved, state.message, state.revision, state.status]);

  return (
    <form
      action={formAction}
      noValidate
      aria-label="Edit note"
      onReset={(event) => event.preventDefault()}
      className="crm-form grid gap-4"
    >
      <h3 id={`edit-note-${note.id}-heading`} className="sr-only">
        Edit note
      </h3>
      <Field
        id={`edit-note-${note.id}-content`}
        label="Note"
        required
        error={state.fieldErrors.content}
      >
        <textarea
          id={`edit-note-${note.id}-content`}
          ref={contentRef}
          name="content"
          rows={4}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={pending}
          maxLength={CUSTOMER_NOTE_MAX_LENGTH}
          aria-invalid={state.fieldErrors.content ? true : undefined}
          aria-describedby={
            state.fieldErrors.content ? `edit-note-${note.id}-content-error` : undefined
          }
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </Field>
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
          {pending ? "Saving…" : "Save"}
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
