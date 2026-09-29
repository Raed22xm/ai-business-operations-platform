"use server";

import {
  CUSTOMER_ACTIVITY_PAGE_SIZE,
  getCustomerActivityPage,
  type CustomerActivity,
} from "@/lib/customer-activity";

export type LoadCustomerActivityResult =
  | {
      status: "success";
      items: CustomerActivity[];
      page: number;
      pageSize: number;
      totalCount: number;
      hasMore: boolean;
    }
  | { status: "error"; message: string };

export async function loadCustomerActivityAction(
  customerId: number,
  page: number = 1,
): Promise<LoadCustomerActivityResult> {
  try {
    const result = await getCustomerActivityPage(customerId, page, CUSTOMER_ACTIVITY_PAGE_SIZE);
    const loaded = result.page * result.pageSize;
    return {
      status: "success",
      items: result.items,
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      hasMore: loaded < result.totalCount,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not load activity for this customer.",
    };
  }
}
