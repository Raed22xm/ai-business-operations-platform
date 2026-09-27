"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { ArrowUpRight, Check, Copy, LockKeyhole, Sparkles } from "lucide-react";
import {
  draftCaseResponseAction,
  generateCaseSummaryAction,
} from "@/app/assistant-actions";
import { CopyBrief } from "@/app/dashboard-tools";
import { caseStatusLabel, type CustomerCase } from "@/lib/cases";
import type { Customer } from "@/lib/customers";

type OutputKind = "summary" | "draft";

type PanelOutput = {
  kind: OutputKind;
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
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<OutputKind | null>(null);
  const [pending, startTransition] = useTransition();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const caseId = work?.id ?? null;
  const statusId = useId();

  function run(kind: OutputKind) {
    if (!caseId || pending) {
      return;
    }

    setError(null);
    setLastAction(kind);
    setCopyState("idle");

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

  const canGenerate = Boolean(caseId) && !pending;

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
          ) : null}
        </div>

        <div className="ai-action-grid" aria-describedby={statusId}>
          <button type="button" disabled title="Coming soon">
            Schedule follow-up
            <span className="action-soon">Coming soon</span>
          </button>
          <button
            type="button"
            className="is-ready"
            disabled={!canGenerate}
            onClick={() => run("draft")}
          >
            Draft response
          </button>
          <button
            type="button"
            className="is-ready"
            disabled={!canGenerate}
            onClick={() => run("summary")}
          >
            Generate summary
          </button>
          <button type="button" disabled title="Coming soon">
            Escalation check
            <span className="action-soon">Coming soon</span>
          </button>
        </div>

        <p id={statusId} className="ai-availability" role="status" aria-live="polite">
          {pending
            ? lastAction === "draft"
              ? "Drafting a customer response…"
              : "Generating a case summary…"
            : error
              ? error
              : work
                ? "Generate a summary or draft from this case’s saved data. Review before sharing."
                : "Select a case to enable Generate summary and Draft response."}
        </p>

        {error ? (
          <div className="assistant-error">
            <button
              type="button"
              className="workspace-button small-button"
              disabled={!canGenerate || !lastAction}
              onClick={() => lastAction && run(lastAction)}
            >
              Retry
            </button>
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
              <span
                role="status"
                className={copyState === "error" ? "copy-error" : "sr-only"}
              >
                {copyState === "copied"
                  ? "Copied to clipboard."
                  : copyState === "error"
                    ? "Couldn’t copy. Try again."
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
