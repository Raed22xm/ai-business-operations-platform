import { Suspense } from "react";
import { CaseDraftsPanel } from "@/app/cases/[id]/case-drafts-panel";
import { getCaseDrafts } from "@/lib/drafts";
import type { ResponseDraft } from "@/lib/drafts-shared";

export function CaseDraftsSection({
  caseId,
  readOnly = false,
}: {
  caseId: number;
  readOnly?: boolean;
}) {
  return (
    <Suspense fallback={<CaseDraftsLoading />}>
      <CaseDraftsLoader caseId={caseId} readOnly={readOnly} />
    </Suspense>
  );
}

async function CaseDraftsLoader({
  caseId,
  readOnly,
}: {
  caseId: number;
  readOnly: boolean;
}) {
  const result = await loadDrafts(caseId);
  return (
    <CaseDraftsPanel
      caseId={caseId}
      initialDrafts={result.drafts}
      initialError={result.error}
      readOnly={readOnly}
    />
  );
}

function CaseDraftsLoading() {
  return (
    <section aria-labelledby="case-drafts-loading-heading" className="crm-section flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="case-drafts-loading-heading" className="text-xl font-semibold tracking-tight">
          Response drafts
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading response drafts…
        </p>
      </div>
    </section>
  );
}

async function loadDrafts(caseId: number): Promise<{
  drafts: ResponseDraft[];
  error: string | null;
}> {
  try {
    const drafts = await getCaseDrafts(caseId);
    return { drafts, error: null };
  } catch (error) {
    return {
      drafts: [],
      error:
        error instanceof Error
          ? error.message
          : "Could not load response drafts for this case.",
    };
  }
}
