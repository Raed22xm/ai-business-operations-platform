"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, UserCheck, UserPlus, Users, ArrowRight, Loader2 } from "lucide-react";
import { createInquiryAction, resolveCustomerAction } from "@/app/inquiry/actions";
import {
  initialInquiryFormState,
  type CustomerMatch,
  type InquiryFormValues,
} from "@/lib/inquiries-shared";

export function InquiryForm() {
  const [state, formAction, isSubmitting] = useActionState(createInquiryAction, initialInquiryFormState);
  const [values, setValues] = useState<InquiryFormValues>(state.values);

  // Customer resolution state
  const [isResolving, startResolve] = useTransition();
  const [hasResolved, setHasResolved] = useState(false);
  const [resolvedMatches, setResolvedMatches] = useState<CustomerMatch[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [confirmCreateNew, setConfirmCreateNew] = useState(false);
  const [lastResolvedEmail, setLastResolvedEmail] = useState("");
  const [prevRevision, setPrevRevision] = useState(state.revision);

  // Sync state values on server action response (preserves entered values on error)
  if (state.revision !== prevRevision) {
    setPrevRevision(state.revision);
    if (state.status === "error" && state.values) {
      setValues(state.values);
      if (state.conflictMatches && state.conflictMatches.length > 0) {
        setResolvedMatches(state.conflictMatches);
        setHasResolved(true);
      }
      if (state.values.selectedCustomerId) {
        setSelectedCustomerId(state.values.selectedCustomerId);
      }
      if (state.values.confirmCreateNew) {
        setConfirmCreateNew(true);
      }
    }
  }

  // Handle email blur to resolve customer
  async function handleEmailBlur() {
    const email = values.customerEmail.trim();
    if (!email || email === lastResolvedEmail) return;

    setLastResolvedEmail(email);
    startResolve(async () => {
      try {
        const response = await resolveCustomerAction(email);
        setResolvedMatches(response.matches);
        setHasResolved(true);

        if (response.matches.length === 1) {
          // Auto-select single match by default, but user can toggle to create new
          setSelectedCustomerId(String(response.matches[0].id));
          setConfirmCreateNew(false);
        } else if (response.matches.length > 1) {
          // Multiple matches: user must select explicitly
          setSelectedCustomerId("");
          setConfirmCreateNew(false);
        } else {
          // No match: will create new customer
          setSelectedCustomerId("");
          setConfirmCreateNew(false);
        }
      } catch {
        // Fallback gracefully if resolution query encounters network issue
        setHasResolved(false);
      }
    });
  }

  function handleFieldChange(field: keyof InquiryFormValues, value: string | boolean) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  const selectedMatch = resolvedMatches.find((m) => String(m.id) === selectedCustomerId);

  return (
    <form
      action={formAction}
      noValidate
      className="crm-form grid gap-6 rounded-xl border border-zinc-700 bg-zinc-900/60 p-6 md:p-8"
      aria-labelledby="inquiry-form-title"
    >
      <div className="flex flex-col gap-1 border-b border-zinc-800 pb-4">
        <h2 id="inquiry-form-title" className="text-xl font-semibold text-zinc-100">
          Internal Customer &amp; Case Intake
        </h2>
        <p className="text-sm text-zinc-400">
          Log an incoming request, verify existing customer profiles by email, and atomically open a tracked case in one transaction.
        </p>
      </div>

      {/* Global Form Error / Conflict Banner */}
      {state.formError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-800/80 bg-red-950/40 p-4 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <strong className="font-semibold">Unable to complete intake</strong>
            <span>{state.formError}</span>
          </div>
        </div>
      ) : null}

      {/* Section 1: Customer Identification & Resolution */}
      <section className="flex flex-col gap-4" aria-labelledby="customer-section-heading">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-emerald-400" aria-hidden="true" />
          <h3 id="customer-section-heading" className="text-base font-semibold text-zinc-200">
            1. Customer Identification
          </h3>
        </div>

        {/* Email Field with Live Resolver */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerEmail" className="text-sm font-medium text-zinc-300">
            Customer email <span className="text-red-400" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id="customerEmail"
              name="customerEmail"
              type="email"
              required
              autoCapitalize="none"
              spellCheck="false"
              placeholder="e.g. client@example.com"
              value={values.customerEmail}
              onChange={(e) => handleFieldChange("customerEmail", e.target.value)}
              onBlur={handleEmailBlur}
              disabled={isSubmitting}
              aria-invalid={state.fieldErrors.customerEmail ? "true" : undefined}
              aria-describedby={
                state.fieldErrors.customerEmail
                  ? "customerEmail-error"
                  : "customerEmail-hint"
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            />
            {isResolving ? (
              <div
                className="absolute right-3 top-3 flex items-center gap-1.5 text-xs text-zinc-400"
                role="status"
              >
                <Loader2 className="size-4 animate-spin text-emerald-400" />
                <span>Checking records…</span>
              </div>
            ) : null}
          </div>
          <p id="customerEmail-hint" className="text-xs text-zinc-400">
            Existing customer records will be looked up automatically by email.
          </p>
          {state.fieldErrors.customerEmail ? (
            <p id="customerEmail-error" role="alert" className="text-xs font-medium text-red-400">
              {state.fieldErrors.customerEmail}
            </p>
          ) : null}
        </div>

        {/* Customer Resolution Feedback / Match Disambiguation */}
        {hasResolved && (
          <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 p-4">
            {resolvedMatches.length === 0 ? (
              <div className="flex items-center gap-2.5 text-sm text-emerald-300" role="status">
                <UserPlus className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>No existing customer matches this email. A new customer profile will be created.</span>
              </div>
            ) : resolvedMatches.length === 1 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-200" role="status">
                  <UserCheck className="size-4 text-emerald-400" aria-hidden="true" />
                  <span>Existing customer record found for this email:</span>
                </div>
                <div className="rounded border border-zinc-700/60 bg-zinc-900/80 p-3 text-sm">
                  <div className="font-semibold text-zinc-100">{resolvedMatches[0].name}</div>
                  <div className="text-xs text-zinc-400">
                    {resolvedMatches[0].company ? `${resolvedMatches[0].company} • ` : ""}
                    {resolvedMatches[0].phone ? `${resolvedMatches[0].phone} • ` : ""}
                    ID #{resolvedMatches[0].id}
                  </div>
                </div>

                <fieldset className="flex flex-col gap-2 pt-1">
                  <legend className="text-xs font-medium text-zinc-400">Choose how to proceed:</legend>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="radio"
                      name="customerResolutionChoice"
                      value="existing"
                      checked={selectedCustomerId === String(resolvedMatches[0].id) && !confirmCreateNew}
                      onChange={() => {
                        setSelectedCustomerId(String(resolvedMatches[0].id));
                        setConfirmCreateNew(false);
                      }}
                      className="size-4 accent-emerald-500"
                    />
                    <span>
                      Use existing customer (<strong>{resolvedMatches[0].name}</strong>). Customer information will not be overwritten.
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="radio"
                      name="customerResolutionChoice"
                      value="new"
                      checked={confirmCreateNew}
                      onChange={() => {
                        setSelectedCustomerId("");
                        setConfirmCreateNew(true);
                      }}
                      className="size-4 accent-emerald-500"
                    />
                    <span>
                      Create as a separate customer with this same email.
                    </span>
                  </label>
                </fieldset>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-300" role="status">
                  <Users className="size-4 text-amber-400" aria-hidden="true" />
                  <span>
                    Multiple customer profiles ({resolvedMatches.length}) share this email. Please select one:
                  </span>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">Select customer match</legend>
                  {resolvedMatches.map((match) => (
                    <label
                      key={match.id}
                      className={`flex cursor-pointer items-start gap-3 rounded border p-3 text-sm transition-colors ${
                        selectedCustomerId === String(match.id)
                          ? "border-emerald-500 bg-emerald-950/20 text-zinc-100"
                          : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="customerMatchSelection"
                        value={match.id}
                        checked={selectedCustomerId === String(match.id)}
                        onChange={() => {
                          setSelectedCustomerId(String(match.id));
                          setConfirmCreateNew(false);
                        }}
                        className="mt-0.5 size-4 accent-emerald-500"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-100">{match.name}</span>
                        <span className="text-xs text-zinc-400">
                          {match.company ? `${match.company} • ` : "No company • "}
                          {match.phone ? `${match.phone} • ` : "No phone • "}
                          Customer #{match.id}
                        </span>
                      </div>
                    </label>
                  ))}

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded border p-3 text-sm transition-colors ${
                      confirmCreateNew
                        ? "border-emerald-500 bg-emerald-950/20 text-zinc-100"
                        : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="customerMatchSelection"
                      value="none"
                      checked={confirmCreateNew}
                      onChange={() => {
                        setSelectedCustomerId("");
                        setConfirmCreateNew(true);
                      }}
                      className="mt-0.5 size-4 accent-emerald-500"
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-100">None of these — Create new customer</span>
                      <span className="text-xs text-zinc-400">
                        Create a separate customer profile with this email address.
                      </span>
                    </div>
                  </label>
                </fieldset>
              </div>
            )}
          </div>
        )}

        {/* Hidden inputs to pass resolved customer ID and new customer confirmation */}
        <input type="hidden" name="selectedCustomerId" value={selectedCustomerId} />
        <input type="hidden" name="confirmCreateNew" value={confirmCreateNew ? "true" : "false"} />

        {/* Name, Company, Phone Fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="customerName" className="text-sm font-medium text-zinc-300">
              Customer name <span className="text-red-400" aria-hidden="true">*</span>
              {selectedMatch && !confirmCreateNew ? (
                <span className="ml-2 text-xs font-normal text-emerald-400">
                  (linked to existing record: {selectedMatch.name})
                </span>
              ) : null}
            </label>
            <input
              id="customerName"
              name="customerName"
              type="text"
              required={!selectedCustomerId}
              placeholder="e.g. Alice Smith"
              value={selectedMatch && !confirmCreateNew ? selectedMatch.name : values.customerName}
              onChange={(e) => handleFieldChange("customerName", e.target.value)}
              disabled={isSubmitting || (Boolean(selectedMatch) && !confirmCreateNew)}
              aria-invalid={state.fieldErrors.customerName ? "true" : undefined}
              aria-describedby={state.fieldErrors.customerName ? "customerName-error" : undefined}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            />
            {state.fieldErrors.customerName ? (
              <p id="customerName-error" role="alert" className="text-xs font-medium text-red-400">
                {state.fieldErrors.customerName}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerCompany" className="text-sm font-medium text-zinc-300">
              Company <span className="text-xs text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="customerCompany"
              name="customerCompany"
              type="text"
              placeholder="e.g. Acme Corp"
              value={selectedMatch && !confirmCreateNew ? selectedMatch.company ?? "" : values.customerCompany}
              onChange={(e) => handleFieldChange("customerCompany", e.target.value)}
              disabled={isSubmitting || (Boolean(selectedMatch) && !confirmCreateNew)}
              aria-invalid={state.fieldErrors.customerCompany ? "true" : undefined}
              aria-describedby={state.fieldErrors.customerCompany ? "customerCompany-error" : undefined}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            />
            {state.fieldErrors.customerCompany ? (
              <p id="customerCompany-error" role="alert" className="text-xs font-medium text-red-400">
                {state.fieldErrors.customerCompany}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerPhone" className="text-sm font-medium text-zinc-300">
              Phone <span className="text-xs text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="customerPhone"
              name="customerPhone"
              type="tel"
              placeholder="e.g. +45 12 34 56 78"
              value={selectedMatch && !confirmCreateNew ? selectedMatch.phone ?? "" : values.customerPhone}
              onChange={(e) => handleFieldChange("customerPhone", e.target.value)}
              disabled={isSubmitting || (Boolean(selectedMatch) && !confirmCreateNew)}
              aria-invalid={state.fieldErrors.customerPhone ? "true" : undefined}
              aria-describedby={state.fieldErrors.customerPhone ? "customerPhone-error" : undefined}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            />
            {state.fieldErrors.customerPhone ? (
              <p id="customerPhone-error" role="alert" className="text-xs font-medium text-red-400">
                {state.fieldErrors.customerPhone}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Section 2: Case & Request Details */}
      <section className="flex flex-col gap-4 border-t border-zinc-800 pt-6" aria-labelledby="case-section-heading">
        <div className="flex items-center gap-2">
          <UserCheck className="size-5 text-emerald-400" aria-hidden="true" />
          <h3 id="case-section-heading" className="text-base font-semibold text-zinc-200">
            2. Request &amp; Case Details
          </h3>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium text-zinc-300">
            Request title <span className="text-red-400" aria-hidden="true">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Urgent query regarding Q3 billing statement"
            value={values.title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            disabled={isSubmitting}
            aria-invalid={state.fieldErrors.title ? "true" : undefined}
            aria-describedby={state.fieldErrors.title ? "title-error" : "title-hint"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span id="title-hint">A new Open case will be created with this title.</span>
            <span>{values.title.length}/200</span>
          </div>
          {state.fieldErrors.title ? (
            <p id="title-error" role="alert" className="text-xs font-medium text-red-400">
              {state.fieldErrors.title}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-zinc-300">
            Inquiry description <span className="text-xs text-zinc-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={4000}
            placeholder="Provide context, customer notes, or details about the inquiry…"
            value={values.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            disabled={isSubmitting}
            aria-invalid={state.fieldErrors.description ? "true" : undefined}
            aria-describedby={state.fieldErrors.description ? "description-error" : undefined}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
          />
          {state.fieldErrors.description ? (
            <p id="description-error" role="alert" className="text-xs font-medium text-red-400">
              {state.fieldErrors.description}
            </p>
          ) : null}
        </div>
      </section>

      {/* Submission Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-800 pt-6">
        <div className="text-xs text-zinc-400">
          Atomically records new customer profile (if applicable), opens case, and logs initial audit activity.
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/cases"
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800/80 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isResolving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>Saving inquiry…</span>
              </>
            ) : (
              <>
                <span>Save inquiry &amp; open case</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
