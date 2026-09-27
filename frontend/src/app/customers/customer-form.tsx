"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomerAction } from "@/app/customers/actions";
import {
  initialCustomerFormState,
  type CustomerField,
} from "@/lib/customer-form-state";
import { customersPageHref } from "@/lib/customers-shared";

const emptyValues: Record<CustomerField, string> = {
  name: "",
  email: "",
  phone: "",
  company: "",
};

const fields: Array<{
  name: CustomerField;
  label: string;
  type: string;
  required: boolean;
  autoComplete: string;
}> = [
  { name: "name", label: "Name", type: "text", required: true, autoComplete: "name" },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", required: false, autoComplete: "tel" },
  { name: "company", label: "Company", type: "text", required: false, autoComplete: "organization" },
];

export function CustomerForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createCustomerAction,
    initialCustomerFormState,
  );
  const [values, setValues] = useState(emptyValues);
  const [clearedRevision, setClearedRevision] = useState(state.revision);
  const shownRevision = useRef(0);

  if (state.status === "success" && state.revision !== clearedRevision) {
    setClearedRevision(state.revision);
    setValues(emptyValues);
  }

  useEffect(() => {
    if (state.status !== "success" || shownRevision.current === state.revision) {
      return;
    }

    shownRevision.current = state.revision;
    router.replace(customersPageHref(null));
  }, [router, state.revision, state.status]);

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="add-customer-heading"
      className="crm-form grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
    >
      <h2 id="add-customer-heading" className="text-lg font-semibold sm:col-span-2">
        Add customer
      </h2>
      {fields.map((field) => (
        <CustomerFieldInput
          key={field.name}
          field={field}
          value={values[field.name]}
          error={state.fieldErrors[field.name]}
          pending={pending}
          onChange={(value) =>
            setValues((current) => ({ ...current, [field.name]: value }))
          }
        />
      ))}
      <div className="flex flex-col items-start gap-3 sm:col-span-2">
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
          {pending ? "Saving…" : "Add customer"}
        </button>
      </div>
    </form>
  );
}

function CustomerFieldInput({
  field,
  value,
  error,
  pending,
  onChange,
}: {
  field: (typeof fields)[number];
  value: string;
  error: string | undefined;
  pending: boolean;
  onChange: (value: string) => void;
}) {
  const errorId = `${field.name}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={field.name} className="text-sm font-medium">
        {field.label}
        {field.required ? (
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <input
        id={field.name}
        name={field.name}
        type={field.type}
        required={field.required}
        autoComplete={field.autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
