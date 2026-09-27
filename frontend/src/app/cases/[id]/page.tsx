import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CaseActivitySection } from "@/app/cases/[id]/case-activity-section";
import { CaseDetails } from "@/app/cases/[id]/case-details";
import { CaseTasksSection } from "@/app/cases/[id]/case-tasks-section";
import { FlashNotice } from "@/app/flash-notice";
import { noticeValue } from "@/lib/flash-notice";
import {
  casesPageHref,
  getCase,
  isCaseArchived,
  isCaseArchiveFilter,
  type CaseArchiveFilter,
  type CaseListFilters,
  type CaseStatus,
} from "@/lib/cases";
import { getCustomer } from "@/lib/customers";
import { getTasksForCase } from "@/lib/tasks";

export const dynamic = "force-dynamic";

type CaseDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    customerId?: string | string[];
    status?: string | string[];
    search?: string | string[];
    archive?: string | string[];
    page?: string | string[];
    notice?: string | string[];
  }>;
};

export async function generateMetadata({ params }: CaseDetailsPageProps) {
  const { id } = await params;
  const caseId = parseCaseId(id);
  if (caseId === null) {
    return { title: "Case not found" };
  }

  try {
    const work = await getCase(caseId);
    if (!work) {
      return { title: "Case not found" };
    }

    return { title: work.title };
  } catch {
    return { title: "Case" };
  }
}

export default async function CaseDetailsPage({
  params,
  searchParams,
}: CaseDetailsPageProps) {
  const { id } = await params;
  const caseId = parseCaseId(id);
  if (caseId === null) {
    notFound();
  }

  const work = await getCase(caseId);
  if (!work) {
    notFound();
  }

  const customer = await getCustomer(work.customerId);
  const customerName = customer?.name ?? "Unknown customer";
  const paramsResolved = await searchParams;
  const listFilters = listFiltersFromSearchParams(paramsResolved);
  const notice = noticeValue(paramsResolved.notice);
  const backHref = casesPageHref(
    listFilters.customerId,
    listFilters.status,
    listFilters.search,
    listFilters.page,
    listFilters.archive,
  );
  const hasIncompleteTasks = await loadHasIncompleteTasks(work.id);

  return (
    <main className="crm-page">
      {notice ? (
        <Suspense fallback={null}>
          <FlashNotice message={notice} />
        </Suspense>
      ) : null}
      <CaseDetails
        work={work}
        customerName={customerName}
        backHref={backHref}
        backLabel="Back to cases"
        hasIncompleteTasks={hasIncompleteTasks}
        listFilters={listFilters}
      />
      <CaseTasksSection caseId={work.id} readOnly={isCaseArchived(work)} />
      <CaseActivitySection caseId={work.id} />
    </main>
  );
}

function parseCaseId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  return Number(value);
}

async function loadHasIncompleteTasks(caseId: number): Promise<boolean> {
  try {
    const tasks = await getTasksForCase(caseId);
    return tasks.some((task) => task.status !== "Done");
  } catch {
    // Conservative: block archive UI until tasks can be verified.
    return true;
  }
}

function listFiltersFromSearchParams(params: {
  customerId?: string | string[];
  status?: string | string[];
  search?: string | string[];
  archive?: string | string[];
  page?: string | string[];
}): CaseListFilters {
  const customerRaw = Array.isArray(params.customerId)
    ? params.customerId[0]
    : params.customerId;
  const statusRaw = Array.isArray(params.status) ? params.status[0] : params.status;
  const searchRaw = Array.isArray(params.search) ? params.search[0] : params.search;
  const archiveRaw = Array.isArray(params.archive) ? params.archive[0] : params.archive;
  const pageRaw = Array.isArray(params.page) ? params.page[0] : params.page;

  const customerId =
    customerRaw && /^[1-9]\d*$/.test(customerRaw) ? Number(customerRaw) : null;
  const status: CaseStatus | null =
    statusRaw === "Open" || statusRaw === "InProgress" || statusRaw === "Closed"
      ? statusRaw
      : null;
  const search = searchRaw?.trim() || null;
  const archive: CaseArchiveFilter | null = isCaseArchiveFilter(archiveRaw)
    ? archiveRaw
    : null;
  const page =
    pageRaw && /^[1-9]\d*$/.test(pageRaw) && Number(pageRaw) > 1
      ? Number(pageRaw)
      : null;

  return { customerId, status, search, archive, page };
}
