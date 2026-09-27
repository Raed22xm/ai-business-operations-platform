"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createCaseAction } from "@/app/cases/actions";
import { initialCaseFormState, type CaseField } from "@/lib/case-form-state";
import { casesPageHref } from "@/lib/cases-shared";

type FormCustomer = {
  id: number;
  name: string;
};

const emptyValues: Record<CaseField, string> = {
  customerId: "",
  title: "",
  description: "",
  status: "",
};

export function CaseForm({ customers }: { customers: FormCustomer[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createCaseAction, initialCaseFormState);
  const [values, setValues] = useState(emptyValues);
  const [clearedRevision, setClearedRevision] = useState(state.revision);
  const shownRevision = useRef(0);

  if (state.status === "success" && state.revision !== clearedRevision) {
    setClearedRevision(state.revision);
    setValues(emptyValues);
  }

  useEffect(() => {
    if (state.status !== "success" || state.customerId === null || shownRevision.current === state.revision) {
      return;
    }

    shownRevision.current = state.revision;
    router.replace(casesPageHref(state.customerId, null, null));
  }, [router, state.customerId, state.revision, state.status]);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="add-case-heading"
      onReset={(event) => event.preventDefault()}
      className="crm-form grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-1">
        <h2 id="add-case-heading" className="text-lg font-semibold">
          Add case
        </h2>
        <p id="case-open-note" className="text-sm text-zinc-600 dark:text-zinc-400">
          New cases start as Open.
        </p>
      </div>
      <Field id="case-customer" label="Customer" required error={state.fieldErrors.customerId}>
        <select
          id="case-customer"
          name="customerId"
          required
          value={values.customerId}
          onChange={(event) => setValues((current) => ({ ...current, customerId: event.target.value }))}
          disabled={pending}
          aria-invalid={state.fieldErrors.customerId ? true : undefined}
          aria-describedby={state.fieldErrors.customerId ? "case-customer-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        >
          <option value="">Select a customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="case-title" label="Title" required error={state.fieldErrors.title}>
        <input
          id="case-title"
          name="title"
          type="text"
          required
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          disabled={pending}
          aria-invalid={state.fieldErrors.title ? true : undefined}
          aria-describedby={state.fieldErrors.title ? "case-title-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </Field>
      <Field id="case-description" label="Description" required={false} error={state.fieldErrors.description}>
        <textarea
          id="case-description"
          name="description"
          rows={3}
          value={values.description}
          onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
          disabled={pending}
          aria-invalid={state.fieldErrors.description ? true : undefined}
          aria-describedby={state.fieldErrors.description ? "case-description-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
      </Field>
      <div className="flex flex-col items-start gap-3">
        {state.status === "success" && state.message ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {state.message}
          </p>
        ) : null}
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
          {pending ? "Saving…" : "Add case"}
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
  error: string | undefined;
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
