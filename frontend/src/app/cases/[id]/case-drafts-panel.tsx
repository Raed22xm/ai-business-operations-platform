"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  approveDraftAction,
  createDraftAction,
  deleteDraftAction,
  generateAndSaveDraftAction,
  loadCaseDraftsAction,
  updateDraftAction,
} from "@/app/cases/[id]/draft-actions";
import {
  DRAFT_MAX_LENGTH,
  draftSourceLabel,
  draftStatusLabel,
  formatDraftDate,
  type ResponseDraft,
} from "@/lib/drafts-shared";

export function CaseDraftsPanel({
  caseId,
  initialDrafts,
  initialError,
  readOnly = false,
}: {
  caseId: number;
  initialDrafts: ResponseDraft[];
  initialError: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ResponseDraft[]>(initialDrafts);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // New manual draft state
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [manualText, setManualText] = useState("");

  // Edit draft state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editInitialText, setEditInitialText] = useState("");
  const [editVersion, setEditVersion] = useState<number>(1);
  const [conflict, setConflict] = useState<{
    currentVersion: number;
    currentContent: string;
  } | null>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // AI generation overwrite warning modal
  const [showAiOverwriteConfirm, setShowAiOverwriteConfirm] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);

  function reloadDrafts() {
    startTransition(async () => {
      setError(null);
      const res = await loadCaseDraftsAction(caseId);
      if (res.status === "error") {
        setError(res.message);
      } else {
        setDrafts(res.drafts);
      }
    });
  }

  function handleStartEdit(draft: ResponseDraft) {
    setEditingId(draft.id);
    setEditText(draft.content);
    setEditInitialText(draft.content);
    setEditVersion(draft.version);
    setConflict(null);
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditInitialText("");
    setConflict(null);
  }

  function handleSaveEdit(versionToSubmit: number) {
    if (editingId === null) return;
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const res = await updateDraftAction(caseId, editingId, editText, versionToSubmit);
      if (res.status === "error") {
        setError(res.message);
        if (res.conflict) {
          setConflict(res.conflict);
        }
        // Unsaved text in editText is carefully preserved!
      } else {
        setDrafts((prev) =>
          prev.map((d) => (d.id === editingId ? res.draft : d)),
        );
        setNotice(res.message ?? "Draft updated successfully.");
        setEditingId(null);
        setEditText("");
        setConflict(null);
        router.refresh();
      }
    });
  }

  function handleApprove(draft: ResponseDraft) {
    if (readOnly) return;
    // Check if user has unsaved edits
    if (editingId === draft.id && editText.trim() !== draft.content.trim()) {
      setError("Approval applies strictly to the exact saved text. Please save your edits first.");
      return;
    }

    setError(null);
    setNotice(null);

    startTransition(async () => {
      const res = await approveDraftAction(caseId, draft.id, draft.content, draft.version);
      if (res.status === "error") {
        setError(res.message);
        if (res.conflict) {
          // Refresh drafts on conflict
          reloadDrafts();
        }
      } else {
        setDrafts((prev) =>
          prev.map((d) => (d.id === draft.id ? res.draft : d)),
        );
        setNotice(res.message ?? "Draft approved.");
        if (editingId === draft.id) {
          setEditingId(null);
        }
        router.refresh();
      }
    });
  }

  async function handleCopy(draftId: number, content: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        copyFallback(content);
      }
      setCopiedId(draftId);
      setTimeout(() => setCopiedId((curr) => (curr === draftId ? null : curr)), 2000);
    } catch {
      try {
        copyFallback(content);
        setCopiedId(draftId);
        setTimeout(() => setCopiedId((curr) => (curr === draftId ? null : curr)), 2000);
      } catch {
        setError("Could not copy draft text to clipboard.");
      }
    }
  }

  function copyFallback(text: string) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (!successful) {
      throw new Error("execCommand failed");
    }
  }

  function handleTriggerAiGeneration() {
    if (readOnly) return;
    // Check if user is currently editing and has unsaved changes
    const hasUnsavedEdits =
      (editingId !== null && editText.trim() !== editInitialText.trim()) ||
      (isCreatingManual && manualText.trim().length > 0);

    if (hasUnsavedEdits) {
      setShowAiOverwriteConfirm(true);
      return;
    }

    executeAiGeneration();
  }

  function executeAiGeneration() {
    setShowAiOverwriteConfirm(false);
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const res = await generateAndSaveDraftAction(caseId);
      if (res.status === "error") {
        setError(res.message);
      } else {
        setDrafts((prev) => [res.draft, ...prev]);
        setNotice(res.message ?? "AI response draft generated and saved.");
        router.refresh();
      }
    });
  }

  function handleSaveManualDraft() {
    if (!manualText.trim()) {
      setError("Please enter draft text before saving.");
      return;
    }

    setError(null);
    setNotice(null);

    startTransition(async () => {
      const res = await createDraftAction(caseId, manualText);
      if (res.status === "error") {
        setError(res.message);
        // manualText is preserved on failure
      } else {
        setDrafts((prev) => [res.draft, ...prev]);
        setNotice("Manual draft saved successfully.");
        setIsCreatingManual(false);
        setManualText("");
        router.refresh();
      }
    });
  }

  function handleDelete(draftId: number) {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const res = await deleteDraftAction(caseId, draftId);
      if (res.status === "error") {
        setError(res.message);
      } else {
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        setNotice("Draft deleted.");
        setDeletingId(null);
        if (editingId === draftId) {
          handleCancelEdit();
        }
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="case-drafts-heading" className="crm-section flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2
              id="case-drafts-heading"
              ref={headingRef}
              className="text-xl font-semibold tracking-tight outline-none"
            >
              Response drafts
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generate, edit, approve, and copy customer response drafts. Approvals apply strictly to exact saved text and never send external messages.
          </p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
            <button
              type="button"
              className="workspace-button is-primary small-button flex items-center gap-1.5"
              onClick={handleTriggerAiGeneration}
              disabled={pending}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>{pending ? "Generating…" : "Generate with AI"}</span>
            </button>
            <button
              type="button"
              className="workspace-button small-button flex items-center gap-1.5"
              onClick={() => {
                setIsCreatingManual((v) => !v);
                setError(null);
              }}
              disabled={pending}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{isCreatingManual ? "Cancel manual draft" : "New manual draft"}</span>
            </button>
          </div>
        )}
      </div>

      {readOnly && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Response drafts are read-only while this case is archived.
        </p>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300"
        >
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="workspace-button small-button mt-1"
            onClick={reloadDrafts}
            disabled={pending}
          >
            <RefreshCw size={12} className={pending ? "animate-spin" : ""} aria-hidden="true" />
            Try reload
          </button>
        </div>
      )}

      {/* Manual draft creation form */}
      {isCreatingManual && !readOnly && (
        <div className="draft-card border-dashed border-zinc-600 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-200">New manual response draft</span>
            <span className="draft-source-badge" data-source="Manual">Manual Draft</span>
          </div>
          <label htmlFor="new-manual-draft-text" className="sr-only">
            Draft response content
          </label>
          <textarea
            id="new-manual-draft-text"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            rows={6}
            maxLength={DRAFT_MAX_LENGTH}
            placeholder="Type customer reply draft here…"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            disabled={pending}
          />
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{manualText.length} / {DRAFT_MAX_LENGTH} characters</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="workspace-button small-button"
                onClick={() => {
                  setIsCreatingManual(false);
                  setManualText("");
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="workspace-button is-primary small-button"
                onClick={handleSaveManualDraft}
                disabled={pending || !manualText.trim()}
              >
                {pending ? "Saving…" : "Save draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drafts list */}
      {drafts.length === 0 && !isCreatingManual ? (
        <div className="rounded-lg border border-zinc-800 p-8 text-center text-sm text-zinc-400">
          <p>No response drafts saved for this case yet.</p>
          {!readOnly && (
            <p className="mt-1 text-zinc-500">
              Click &quot;Generate with AI&quot; to draft a personalized reply from case notes, or &quot;New manual draft&quot; to write one.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {drafts.map((draft) => {
            const isEditing = editingId === draft.id;
            const isApproved = draft.status === "Approved";
            const isMock = draft.source === "Mock";

            return (
              <article
                key={draft.id}
                className={`draft-card ${isApproved ? "is-approved" : ""}`}
                aria-label={`Response draft #${draft.id}, ${draftStatusLabel(draft.status)}`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-semibold text-zinc-200">
                      Draft #{draft.id}
                    </span>
                    <span className="record-status" data-status={draft.status}>
                      {draftStatusLabel(draft.status)}
                    </span>
                    <span className="draft-source-badge" data-source={draft.source}>
                      {draftSourceLabel(draft.source)}
                    </span>
                    {isMock && (
                      <span className="rounded bg-amber-950/80 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-800/80">
                        Demo response (AI not connected)
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="text-xs text-zinc-400">
                    <span>Created by {draft.createdBy} · {formatDraftDate(draft.createdAt)}</span>
                    {draft.updatedAt && (
                      <span> · Edited {formatDraftDate(draft.updatedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Approved info banner */}
                {isApproved && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>
                      Approved by <strong>{draft.approvedBy}</strong> on {formatDraftDate(draft.approvedAt)}. Exact saved text locked. (No external message sent).
                    </span>
                  </div>
                )}

                {/* Edit mode */}
                {isEditing && !readOnly ? (
                  <div className="flex flex-col gap-3">
                    {isApproved && (
                      <div className="flex items-center gap-2 rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
                        <span>
                          Notice: Saving edits to this approved draft will reset its status to <strong>Draft</strong> and clear human approval.
                        </span>
                      </div>
                    )}

                    {conflict && (
                      <div className="draft-conflict-box flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                          <AlertTriangle size={16} aria-hidden="true" />
                          <span>Conflicting update detected</span>
                        </div>
                        <p className="text-xs">
                          This draft was updated elsewhere to Version {conflict.currentVersion}. Your unsaved edits are preserved below so your work is safe.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            className="workspace-button small-button bg-amber-600 hover:bg-amber-500 text-black font-semibold text-xs"
                            onClick={() => handleSaveEdit(conflict.currentVersion)}
                            disabled={pending}
                          >
                            Overwrite server with my edits
                          </button>
                          <button
                            type="button"
                            className="workspace-button small-button text-xs"
                            onClick={() => {
                              setEditText(conflict.currentContent);
                              setEditVersion(conflict.currentVersion);
                              setConflict(null);
                            }}
                            disabled={pending}
                          >
                            Discard my edits &amp; load server version
                          </button>
                        </div>
                      </div>
                    )}

                    <label htmlFor={`edit-draft-text-${draft.id}`} className="sr-only">
                      Edit draft text
                    </label>
                    <textarea
                      id={`edit-draft-text-${draft.id}`}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-3.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                      rows={8}
                      maxLength={DRAFT_MAX_LENGTH}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      disabled={pending}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                      <span>{editText.length} / {DRAFT_MAX_LENGTH} characters · Version {draft.version}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="workspace-button small-button"
                          onClick={handleCancelEdit}
                          disabled={pending}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="workspace-button is-primary small-button"
                          onClick={() => handleSaveEdit(editVersion)}
                          disabled={pending || !editText.trim()}
                        >
                          {pending ? "Saving…" : "Save edits"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex flex-col gap-3">
                    <pre className="draft-content-text">{draft.content}</pre>

                    {/* Actions bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="workspace-button small-button flex items-center gap-1.5"
                          onClick={() => handleCopy(draft.id, draft.content)}
                          title="Copy draft to clipboard"
                        >
                          {copiedId === draft.id ? (
                            <>
                              <Check size={13} className="text-emerald-400" aria-hidden="true" />
                              <span className="text-emerald-400 font-medium">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} aria-hidden="true" />
                              <span>Copy text</span>
                            </>
                          )}
                        </button>
                        <span role="status" className="sr-only">
                          {copiedId === draft.id ? `Draft #${draft.id} copied to clipboard.` : ""}
                        </span>

                        {!readOnly && (
                          <button
                            type="button"
                            className="workspace-button small-button flex items-center gap-1.5"
                            onClick={() => handleStartEdit(draft)}
                            disabled={pending}
                          >
                            <Edit3 size={13} aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                        )}

                        {!readOnly && !isApproved && (
                          <button
                            type="button"
                            className="workspace-button small-button text-emerald-400 border-emerald-800/80 hover:bg-emerald-950/40 flex items-center gap-1.5"
                            onClick={() => handleApprove(draft)}
                            disabled={pending}
                            title="Approve this draft (applies strictly to the exact saved text)"
                          >
                            <CheckCircle2 size={13} aria-hidden="true" />
                            <span>Approve draft</span>
                          </button>
                        )}
                      </div>

                      {!readOnly && (
                        <div>
                          {deletingId === draft.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-400">Delete this draft?</span>
                              <button
                                type="button"
                                className="workspace-button small-button bg-red-700 hover:bg-red-600 text-white text-xs"
                                onClick={() => handleDelete(draft.id)}
                                disabled={pending}
                              >
                                Confirm delete
                              </button>
                              <button
                                type="button"
                                className="workspace-button small-button text-xs"
                                onClick={() => setDeletingId(null)}
                                disabled={pending}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="workspace-button small-button text-zinc-500 hover:text-red-400"
                              onClick={() => setDeletingId(draft.id)}
                              disabled={pending}
                              title="Delete draft"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                              <span className="sr-only">Delete draft #{draft.id}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog for AI generation when unsaved edits are dirty */}
      {showAiOverwriteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle size={20} aria-hidden="true" />
              <h3 id="ai-confirm-title" className="font-semibold text-lg text-zinc-100">
                Unsaved edits in progress
              </h3>
            </div>
            <p className="text-sm text-zinc-300">
              You have unsaved edits in an active draft. Generating a new AI draft will save as a new separate draft, but we want to make sure you don&apos;t get interrupted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                className="workspace-button small-button"
                onClick={() => setShowAiOverwriteConfirm(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="workspace-button is-primary small-button"
                onClick={executeAiGeneration}
              >
                Continue &amp; generate
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
