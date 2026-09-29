"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import {
  checkCaseEscalationAction,
  draftCaseResponseAction,
  generateCaseSummaryAction,
} from "@/app/assistant-actions";
import { createDraftAction } from "@/app/cases/[id]/draft-actions";
import { CopyBrief } from "@/app/dashboard-tools";
import { caseStatusLabel, isCaseArchived, type CustomerCase } from "@/lib/cases-shared";
import type { Customer } from "@/lib/customers-shared";
import type { CaseEscalationResult } from "@/lib/escalation-shared";
import { ScheduleFollowUpForm } from "@/app/schedule-follow-up-form";

type OutputKind = "summary" | "draft" | "escalation";

type PanelOutput = {
  kind: "summary" | "draft";
  text: string;
  source: "openai" | "mock";
  setupHint: string | null;
};

export function AssistantPanel({
  customer,
  work,
}: {
  customer?: Customer;
  work?: CustomerCase;
}) {
  const brief = work
    ? `${work.title}\n\nCustomer: ${customer?.name ?? "Unknown customer"}\nStatus: ${caseStatusLabel(work.status)}\n\n${work.description || "No description added."}`
    : "Select a customer with a case to see its brief here.";

  const [output, setOutput] = useState<PanelOutput | null>(null);
  const [escalationData, setEscalationData] = useState<CaseEscalationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<OutputKind | null>(null);
  const [pending, startTransition] = useTransition();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [saveDraftState, setSaveDraftState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSchedulingFollowUp, setIsSchedulingFollowUp] = useState(false);
  const caseId = work?.id ?? null;
  const isArchived = work ? isCaseArchived(work) : false;
  const statusId = useId();

  // Clear results whenever the selected case changes
  const [prevCaseId, setPrevCaseId] = useState<number | null>(work?.id ?? null);
  if ((work?.id ?? null) !== prevCaseId) {
    setPrevCaseId(work?.id ?? null);
    setOutput(null);
    setEscalationData(null);
    setError(null);
    setLastAction(null);
    setIsSchedulingFollowUp(false);
  }

  function run(kind: OutputKind) {
    if (!caseId || pending) {
      return;
    }

    setError(null);
    setLastAction(kind);
    setCopyState("idle");
    setSaveDraftState("idle");

    if (kind === "escalation") {
      setOutput(null);
      startTransition(async () => {
        const result = await checkCaseEscalationAction(caseId);
        if (result.status === "error") {
          setEscalationData(null);
          setError(result.message);
          return;
        }

        setError(null);
        setEscalationData(result.data);
      });
      return;
    }

    setEscalationData(null);
    startTransition(async () => {
      const result =
        kind === "summary"
          ? await generateCaseSummaryAction(caseId)
          : await draftCaseResponseAction(caseId);

      if (result.status === "error") {
        setOutput(null);
        setError(result.message);
        return;
      }

      setError(null);
      setOutput({
        kind: result.kind,
        text: result.kind === "summary" ? result.data.formattedText : result.data.draftText,
        source: result.data.source,
        setupHint: result.data.setupHint ?? null,
      });
    });
  }

  const canGenerate = Boolean(caseId) && !isArchived && !pending;
  const canCheck = Boolean(caseId) && !isArchived && !pending;
  const canSchedule = Boolean(work) && !isArchived;

  return (
    <section
      id="assistant-workspace"
      className="work-panel assistant-panel"
      aria-labelledby="assistant-heading"
    >
      <div className="panel-heading">
        <h2 id="assistant-heading">AI operations assistant</h2>
        <Sparkles size={16} className="assistant-sparkle" aria-hidden="true" />
      </div>
      <div className="assistant-body">
        <div className="assistant-action-heading">
          <h3>AI quick actions</h3>
          {!work ? (
            <span className="coming-soon">
              <LockKeyhole size={10} aria-hidden="true" />
              Select a case
            </span>
          ) : isArchived ? (
            <span className="coming-soon">
              <LockKeyhole size={10} aria-hidden="true" />
              Archived case
            </span>
          ) : null}
        </div>

        <div className="ai-action-grid" aria-describedby={statusId}>
          <button
            type="button"
            className={canSchedule ? "is-ready" : undefined}
            disabled={!canSchedule}
            aria-expanded={isSchedulingFollowUp}
            onClick={() => setIsSchedulingFollowUp((prev) => !prev)}
            title={
              !work
                ? "Select a case to schedule a follow-up task"
                : isArchived
                  ? "Follow-ups cannot be scheduled for archived cases"
                  : isSchedulingFollowUp
                    ? "Close follow-up form"
                    : "Schedule a follow-up task for this case"
            }
          >
            Schedule follow-up
            {!work ? (
              <span className="action-soon">Select case</span>
            ) : isArchived ? (
              <span className="action-soon">Archived</span>
            ) : null}
          </button>
          <button
            type="button"
            className={canGenerate ? "is-ready" : undefined}
            disabled={!canGenerate}
            onClick={() => run("draft")}
            title={
              !work
                ? "Select a case to draft a response"
                : isArchived
                  ? "Cannot draft responses for archived cases"
                  : "Draft a response for this case"
            }
          >
            Draft response
            {!work ? (
              <span className="action-soon">Select case</span>
            ) : isArchived ? (
              <span className="action-soon">Archived</span>
            ) : null}
          </button>
          <button
            type="button"
            className={canGenerate ? "is-ready" : undefined}
            disabled={!canGenerate}
            onClick={() => run("summary")}
            title={
              !work
                ? "Select a case to generate a summary"
                : isArchived
                  ? "Cannot generate summaries for archived cases"
                  : "Generate a summary of this case"
            }
          >
            Generate summary
            {!work ? (
              <span className="action-soon">Select case</span>
            ) : isArchived ? (
              <span className="action-soon">Archived</span>
            ) : null}
          </button>
          <button
            type="button"
            className={canCheck ? "is-ready" : undefined}
            disabled={!canCheck}
            onClick={() => run("escalation")}
            title={
              !work
                ? "Select a case to check for escalation flags"
                : isArchived
                  ? "Archived cases cannot be evaluated for escalation"
                  : "Check for overdue tasks, high-priority work, and open cases needing tasks"
            }
          >
            Escalation check
            {!work ? (
              <span className="action-soon">Select case</span>
            ) : isArchived ? (
              <span className="action-soon">Archived</span>
            ) : null}
          </button>
        </div>

        <p id={statusId} className="ai-availability" role="status" aria-live="polite">
          {pending
            ? lastAction === "draft"
              ? "Drafting a customer response…"
              : lastAction === "summary"
                ? "Generating a case summary…"
                : "Checking case for attention flags…"
            : error
              ? error
              : work
                ? isArchived
                  ? "This case is archived. Restore it to schedule follow-ups or generate updates."
                  : isSchedulingFollowUp
                    ? "Schedule an internal follow-up task. It will appear on the case timeline and due date views."
                    : "Generate a summary or draft, or run an escalation check on this case."
                : "Select a case to enable follow-ups, summaries, response drafts, and escalation checks."}
        </p>

        {isSchedulingFollowUp && work && !isArchived ? (
          <ScheduleFollowUpForm
            key={work.id}
            caseId={work.id}
            caseTitle={work.title}
            customerName={customer?.name}
            onClose={() => setIsSchedulingFollowUp(false)}
          />
        ) : null}

        {error ? (
          <div className="assistant-error">
            <button
              type="button"
              className="workspace-button small-button"
              disabled={pending || !lastAction}
              onClick={() => lastAction && run(lastAction)}
            >
              Retry
            </button>
          </div>
        ) : null}

        {escalationData ? (
          <div className="escalation-output">
            <div className="detail-label">
              <span>Escalation check</span>
              <span
                className={
                  escalationData.flags.length > 0
                    ? "escalation-badge is-attention"
                    : "escalation-badge is-clean"
                }
              >
                {escalationData.flags.length > 0 ? "Needs review" : "Deterministic rules"}
              </span>
            </div>

            {escalationData.flags.length === 0 ? (
              <div
                className="escalation-clean-state"
                role="status"
                aria-label="No attention flags found"
              >
                <CheckCircle2 size={18} className="escalation-clean-icon" aria-hidden="true" />
                <div className="escalation-clean-content">
                  <strong>No attention flags found.</strong>
                  <p>No overdue tasks, high-priority work, or unstaffed case conditions detected.</p>
                </div>
              </div>
            ) : (
              <div className="escalation-card" role="status" aria-label="Escalation review items">
                <div className="escalation-summary-bar">
                  <AlertTriangle size={15} className="escalation-alert-icon" aria-hidden="true" />
                  <span className="escalation-summary-text">{escalationData.summaryMessage}</span>
                </div>
                <ul className="escalation-list" aria-label="Needs review items">
                  {escalationData.flags.map((flag, index) => (
                    <li
                      key={`${flag.rule}-${flag.taskId ?? index}`}
                      className="escalation-flag-item"
                    >
                      <div className="escalation-flag-header">
                        <span className="escalation-tag">Needs review</span>
                        <span className="escalation-rule-tag">
                          {flag.rule === "OverdueTask"
                            ? "Overdue task"
                            : flag.rule === "HighPriorityTask"
                              ? "High priority"
                              : "No unfinished tasks"}
                        </span>
                      </div>
                      <p className="escalation-flag-reason">{flag.reason}</p>
                      {flag.taskId ? (
                        <Link
                          href={`/cases/${caseId}#task-${flag.taskId}`}
                          className="escalation-task-link"
                        >
                          <span>
                            View task {flag.taskTitle ? `“${flag.taskTitle}”` : `#${flag.taskId}`}
                          </span>
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </Link>
                      ) : (
                        <Link
                          href={`/cases/${caseId}#case-tasks-heading`}
                          className="escalation-task-link"
                        >
                          <span>Open case tasks</span>
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {output ? (
          <div className="assistant-output">
            <p className="detail-label">
              {output.kind === "summary" ? "Generated summary" : "Draft response"}
              <span className={output.source === "mock" ? "assistant-source is-demo" : "assistant-source"}>
                {output.source === "mock" ? "Demo response — AI not connected" : "For review"}
              </span>
            </p>
            {output.source === "mock" ? (
              <p className="assistant-demo-banner" role="status">
                Demo response — AI not connected
              </p>
            ) : null}
            <label className="sr-only" htmlFor={`${statusId}-output`}>
              {output.kind === "summary" ? "Generated summary text" : "Draft response text"}
            </label>
            <textarea
              id={`${statusId}-output`}
              className="assistant-output-text"
              value={output.text}
              onChange={(event) =>
                setOutput((current) =>
                  current ? { ...current, text: event.target.value } : current,
                )
              }
              rows={8}
            />
            <div className="assistant-output-actions">
              <button
                type="button"
                className="workspace-button small-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(output.text);
                    setCopyState("copied");
                  } catch {
                    setCopyState("error");
                  }
                }}
              >
                {copyState === "copied" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copyState === "copied" ? "Copied" : "Copy"}
              </button>
              {output.kind === "draft" && caseId ? (
                <button
                  type="button"
                  className="workspace-button small-button"
                  disabled={saveDraftState === "saving" || saveDraftState === "saved"}
                  onClick={async () => {
                    setSaveDraftState("saving");
                    const res = await createDraftAction(caseId, output.text);
                    if (res.status === "success") {
                      setSaveDraftState("saved");
                    } else {
                      setSaveDraftState("error");
                    }
                  }}
                >
                  {saveDraftState === "saved" ? (
                    <>
                      <Check size={13} className="text-emerald-400" aria-hidden="true" />
                      <span className="text-emerald-400">Saved to case drafts</span>
                    </>
                  ) : saveDraftState === "saving" ? (
                    "Saving to case…"
                  ) : (
                    "Save to case drafts"
                  )}
                </button>
              ) : null}
              <span
                role="status"
                className={copyState === "error" || saveDraftState === "error" ? "copy-error" : "sr-only"}
              >
                {copyState === "copied"
                  ? "Copied to clipboard."
                  : copyState === "error"
                    ? "Couldn’t copy. Try again."
                    : saveDraftState === "saved"
                      ? "Draft saved to case."
                      : saveDraftState === "error"
                        ? "Could not save draft to case."
                        : ""}
              </span>
            </div>
            {output.setupHint ? (
              <p className="assistant-setup-hint">{output.setupHint}</p>
            ) : null}
          </div>
        ) : null}

        <div className="assistant-preview">
          <p className="detail-label">
            Case brief <span>From your saved data</span>
          </p>
          <div className="brief-surface">
            <p className="brief-greeting">
              {customer ? `For ${customer.name}` : "Your case at a glance"}
            </p>
            <p className="brief-description">
              {work
                ? work.description || work.title
                : "Select a case to keep its important details close at hand."}
            </p>
            <div className="brief-actions">
              <CopyBrief key={work?.id ?? "empty"} brief={brief} disabled={!work} />
              {work ? (
                <Link
                  href={`/cases/${work.id}`}
                  className="workspace-button is-primary small-button"
                >
                  Open case
                  <ArrowUpRight size={13} />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
