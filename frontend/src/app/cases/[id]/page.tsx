import { notFound } from "next/navigation";
import { CaseDetails } from "@/app/cases/[id]/case-details";
import { SiteNav } from "@/app/site-nav";
import {
  casesPageHref,
  getCase,
  type CaseListFilters,
  type CaseStatus,
} from "@/lib/cases";
import { getCustomer } from "@/lib/customers";

export const dynamic = "force-dynamic";

type CaseDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    customerId?: string | string[];
    status?: string | string[];
    search?: string | string[];
    page?: string | string[];
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
  const listFilters = listFiltersFromSearchParams(await searchParams);
  const backHref = casesPageHref(
    listFilters.customerId,
    listFilters.status,
    listFilters.search,
    listFilters.page,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <SiteNav current="cases" />
      <CaseDetails
        work={work}
        customerName={customerName}
        backHref={backHref}
        backLabel="Back to cases"
      />
    </main>
  );
}

function parseCaseId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  return Number(value);
}

function listFiltersFromSearchParams(params: {
  customerId?: string | string[];
  status?: string | string[];
  search?: string | string[];
  page?: string | string[];
}): CaseListFilters {
  const customerRaw = Array.isArray(params.customerId)
    ? params.customerId[0]
    : params.customerId;
  const statusRaw = Array.isArray(params.status) ? params.status[0] : params.status;
  const searchRaw = Array.isArray(params.search) ? params.search[0] : params.search;
  const pageRaw = Array.isArray(params.page) ? params.page[0] : params.page;

  const customerId =
    customerRaw && /^[1-9]\d*$/.test(customerRaw) ? Number(customerRaw) : null;
  const status: CaseStatus | null =
    statusRaw === "Open" || statusRaw === "InProgress" || statusRaw === "Closed"
      ? statusRaw
      : null;
  const search = searchRaw?.trim() || null;
  const page =
    pageRaw && /^[1-9]\d*$/.test(pageRaw) && Number(pageRaw) > 1
      ? Number(pageRaw)
      : null;

  return { customerId, status, search, page };
}
