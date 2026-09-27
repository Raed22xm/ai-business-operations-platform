import { notFound } from "next/navigation";
import { CustomerCasesSection } from "@/app/customers/[id]/customer-cases-section";
import { CustomerDetails } from "@/app/customers/[id]/customer-details";
import { SiteNav } from "@/app/site-nav";
import { casesPageHref, getCases } from "@/lib/cases";
import {
  customersPageHref,
  getCustomer,
} from "@/lib/customers";

export const dynamic = "force-dynamic";

type CustomerDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    search?: string | string[];
    page?: string | string[];
  }>;
};

export async function generateMetadata({ params }: CustomerDetailsPageProps) {
  const { id } = await params;
  const customerId = parseCustomerId(id);
  if (customerId === null) {
    return { title: "Customer not found" };
  }

  try {
    const customer = await getCustomer(customerId);
    if (!customer) {
      return { title: "Customer not found" };
    }

    return { title: customer.name };
  } catch {
    return { title: "Customer" };
  }
}

export default async function CustomerDetailsPage({
  params,
  searchParams,
}: CustomerDetailsPageProps) {
  const { id } = await params;
  const customerId = parseCustomerId(id);
  if (customerId === null) {
    notFound();
  }

  const customer = await getCustomer(customerId);
  if (!customer) {
    notFound();
  }

  const listParams = await searchParams;
  const listSearch = searchValue(listParams.search);
  const listPage = pageValue(listParams.page);
  const backHref = customersPageHref(
    listSearch || null,
    listPage > 1 ? listPage : null,
  );
  const casesHref = casesPageHref(customer.id, null, null);

  const casesResult = await loadCustomerCases(customer.id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <SiteNav current="customers" />
      <CustomerDetails
        customer={customer}
        backHref={backHref}
        backLabel="Back to customers"
      />
      <CustomerCasesSection
        customerName={customer.name}
        casesHref={casesHref}
        cases={casesResult.cases}
        loadError={casesResult.error}
      />
    </main>
  );
}

async function loadCustomerCases(customerId: number): Promise<{
  cases: Awaited<ReturnType<typeof getCases>> | null;
  error: string | null;
}> {
  try {
    const cases = await getCases({ customerId });
    return { cases, error: null };
  } catch {
    return {
      cases: null,
      error: "Could not load cases for this customer. Check that the API is running, then try again.",
    };
  }
}

function parseCustomerId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  return Number(value);
}

function searchValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

function pageValue(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    return 1;
  }

  return Number(raw);
}
