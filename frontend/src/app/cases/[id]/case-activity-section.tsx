import { Suspense } from "react";
import { CaseActivityFeed } from "@/app/cases/[id]/case-activity-feed";
import {
  CASE_ACTIVITY_PAGE_SIZE,
  getCaseActivityPage,
  type CaseActivity,
} from "@/lib/case-activity";

export function CaseActivitySection({ caseId }: { caseId: number }) {
  return (
    <Suspense fallback={<CaseActivityLoading />}>
      <CaseActivityLoader caseId={caseId} />
    </Suspense>
  );
}

async function CaseActivityLoader({ caseId }: { caseId: number }) {
  const result = await loadFirstPage(caseId);
  return (
    <CaseActivityFeed
      caseId={caseId}
      initialItems={result.items}
      initialPage={result.page}
      initialTotalCount={result.totalCount}
      initialHasMore={result.hasMore}
      initialError={result.error}
    />
  );
}

function CaseActivityLoading() {
  return (
    <section aria-labelledby="case-activity-heading" className="crm-section flex flex-col gap-4">
      <h2 id="case-activity-heading" className="text-xl font-semibold tracking-tight">
        Activity
      </h2>
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading activity…
      </p>
    </section>
  );
}

async function loadFirstPage(caseId: number): Promise<{
  items: CaseActivity[];
  page: number;
  totalCount: number;
  hasMore: boolean;
  error: string | null;
}> {
  try {
    const page = await getCaseActivityPage(caseId, 1, CASE_ACTIVITY_PAGE_SIZE);
    return {
      items: page.items,
      page: page.page,
      totalCount: page.totalCount,
      hasMore: page.page * page.pageSize < page.totalCount,
      error: null,
    };
  } catch (error) {
    return {
      items: [],
      page: 0,
      totalCount: 0,
      hasMore: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load activity for this case.",
    };
  }
}
