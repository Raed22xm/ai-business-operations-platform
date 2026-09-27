import { Suspense } from "react";
import { CustomerNotesPanel } from "@/app/customers/[id]/customer-notes-panel";
import {
  CUSTOMER_NOTES_PAGE_SIZE,
  getCustomerNotesPage,
  type CustomerNote,
} from "@/lib/customer-notes";

export function CustomerNotesSection({ customerId }: { customerId: number }) {
  return (
    <Suspense fallback={<CustomerNotesLoading />}>
      <CustomerNotesLoader customerId={customerId} />
    </Suspense>
  );
}

async function CustomerNotesLoader({ customerId }: { customerId: number }) {
  const result = await loadFirstPage(customerId);
  return (
    <CustomerNotesPanel
      customerId={customerId}
      initialItems={result.items}
      initialPage={result.page}
      initialTotalCount={result.totalCount}
      initialHasMore={result.hasMore}
      initialError={result.error}
    />
  );
}

function CustomerNotesLoading() {
  return (
    <section aria-labelledby="customer-notes-heading" className="crm-section flex flex-col gap-4">
      <h2 id="customer-notes-heading" className="text-xl font-semibold tracking-tight">
        Notes
      </h2>
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading notes…
      </p>
    </section>
  );
}

async function loadFirstPage(customerId: number): Promise<{
  items: CustomerNote[];
  page: number;
  totalCount: number;
  hasMore: boolean;
  error: string | null;
}> {
  try {
    const page = await getCustomerNotesPage(customerId, 1, CUSTOMER_NOTES_PAGE_SIZE);
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
          : "Could not load notes for this customer.",
    };
  }
}
