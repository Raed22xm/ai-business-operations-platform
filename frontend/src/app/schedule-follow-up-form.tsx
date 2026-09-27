"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  scheduleFollowUpAction,
  type ScheduleFollowUpResult,
} from "@/app/assistant-actions";
import type { TaskPriority } from "@/lib/tasks-shared";

export function ScheduleFollowUpForm({
  caseId,
  caseTitle,
  customerName,
  onClose,
}: {
  caseId: number;
  caseTitle: string;
  customerName?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const defaultTitle = `Follow up with ${customerName || "customer"}`;

  const [title, setTitle] = useState(defaultTitle);
  const [dueDate, setDueDate] = useState(""); // Do not choose a date automatically!
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Normal");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successResult, setSuccessResult] = useState<Extract<
    ScheduleFollowUpResult,
    { status: "success" }
  > | null>(null);

  const [pending, startTransition] = useTransition();
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // Keyboard Escape support
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Please enter a follow-up title.");
      setFieldErrors({ title: "Follow-up title is required." });
      return;
    }

    if (!dueDate) {
      setError("Please choose a target due date.");
      setFieldErrors({ dueDate: "Due date is required for a follow-up reminder." });
      return;
    }

    startTransition(async () => {
      const res = await scheduleFollowUpAction(caseId, {
        title: trimmedTitle,
        dueDate,
        description: description.trim() || null,
        priority,
      });

      if (res.status === "error") {
        setError(res.message);
        if (res.fieldErrors) {
          const errors: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            if (v) errors[k] = v;
          }
          setFieldErrors(errors);
        }
        // Entered values (title, dueDate, description, priority) are preserved in state!
      } else {
        setSuccessResult(res);
        router.refresh();
      }
    });
  }

  return (
    <div
      className="followup-card"
      role="region"
      aria-labelledby="schedule-followup-heading"
    >
      <div className="followup-header">
        <h4 id="schedule-followup-heading">
          <CalendarClock size={15} className="text-emerald-400" aria-hidden="true" />
          <span>Schedule follow-up</span>
        </h4>
        <button
          type="button"
          className="text-zinc-400 hover:text-zinc-200 p-1"
          onClick={onClose}
          aria-label="Close follow-up form"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="followup-context">
        <div>
          <span className="text-zinc-400">Customer: </span>
          <span className="font-semibold text-zinc-200">{customerName || "Unknown customer"}</span>
        </div>
        <div>
          <span className="text-zinc-400">Case: </span>
          <span className="font-semibold text-zinc-200">{caseTitle} (#{caseId})</span>
        </div>
      </div>

      <p className="followup-disclosure">
        This schedules an internal task for your team. It does not send an email, SMS, or notification to the customer.
      </p>

      {successResult ? (
        <div className="followup-success" role="status" aria-live="polite">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" aria-hidden="true" />
            <span>Follow-up scheduled</span>
          </div>
          <p className="text-xs text-emerald-200">
            {successResult.message}
          </p>
          <p className="text-[11px] text-emerald-300/80">
            Internal task only; no customer notification was sent.
          </p>
          <div className="flex items-center justify-between pt-2">
            <Link
              href={`/cases/${caseId}`}
              className="text-xs text-emerald-400 hover:underline font-medium"
            >
              View on case #{caseId} &rarr;
            </Link>
            <button
              type="button"
              className="workspace-button small-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="followup-form" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded border border-red-900/60 bg-red-950/40 p-2 text-xs text-red-300"
            >
              <AlertTriangle size={14} className="shrink-0 text-red-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <label htmlFor="followup-title">
            <span>Follow-up title <span className="text-red-400" aria-hidden="true">*</span></span>
            <input
              id="followup-title"
              ref={titleInputRef}
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "followup-title-error" : undefined}
            />
          </label>
          {fieldErrors.title && (
            <p id="followup-title-error" className="followup-error">
              {fieldErrors.title}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="followup-due-date">
                <span>Due date <span className="text-red-400" aria-hidden="true">*</span></span>
                <input
                  id="followup-due-date"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors.dueDate)}
                  aria-describedby={fieldErrors.dueDate ? "followup-due-date-error" : undefined}
                />
              </label>
              {fieldErrors.dueDate && (
                <p id="followup-due-date-error" className="followup-error">
                  {fieldErrors.dueDate}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="followup-priority">
                <span>Priority</span>
                <select
                  id="followup-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  disabled={pending}
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                </select>
              </label>
            </div>
          </div>

          <label htmlFor="followup-description">
            <span>Description (optional)</span>
            <textarea
              id="followup-description"
              rows={3}
              placeholder="e.g. Call to discuss satisfaction, renewal options, or check project milestones."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={pending}
            />
          </label>

          <div className="followup-actions">
            <button
              type="button"
              className="workspace-button small-button"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="workspace-button is-primary small-button"
              disabled={pending}
            >
              {pending ? "Scheduling…" : "Save follow-up"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
