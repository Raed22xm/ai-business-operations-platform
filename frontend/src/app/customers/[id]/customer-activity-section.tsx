import { Suspense } from "react";
import { CustomerActivityFeed } from "@/app/customers/[id]/customer-activity-feed";
import {
  CUSTOMER_ACTIVITY_PAGE_SIZE,
  getCustomerActivityPage,
  type CustomerActivity,
} from "@/lib/customer-activity";

export function CustomerActivitySection({ customerId }: { customerId: number }) {
  return (
    <Suspense fallback={<CustomerActivityLoading />}>
      <CustomerActivityLoader customerId={customerId} />
    </Suspense>
  );
}

async function CustomerActivityLoader({ customerId }: { customerId: number }) {
  const result = await loadFirstPage(customerId);
  return (
    <CustomerActivityFeed
      customerId={customerId}
      initialItems={result.items}
      initialPage={result.page}
      initialTotalCount={result.totalCount}
      initialHasMore={result.hasMore}
      initialError={result.error}
    />
  );
}

function CustomerActivityLoading() {
  return (
    <section aria-labelledby="customer-activity-heading" className="crm-section flex flex-col gap-4">
      <h2 id="customer-activity-heading" className="text-xl font-semibold tracking-tight">
        Activity Timeline
      </h2>
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading activity…
      </p>
    </section>
  );
}

async function loadFirstPage(customerId: number): Promise<{
  items: CustomerActivity[];
  page: number;
  totalCount: number;
  hasMore: boolean;
  error: string | null;
}> {
  try {
    const page = await getCustomerActivityPage(customerId, 1, CUSTOMER_ACTIVITY_PAGE_SIZE);
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
          : "Could not load activity for this customer.",
    };
  }
}
