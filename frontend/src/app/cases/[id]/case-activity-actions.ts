"use server";

import {
  CASE_ACTIVITY_PAGE_SIZE,
  getCaseActivityPage,
  type CaseActivity,
} from "@/lib/case-activity";

export type LoadCaseActivityResult =
  | {
      status: "success";
      items: CaseActivity[];
      page: number;
      pageSize: number;
      totalCount: number;
      hasMore: boolean;
    }
  | { status: "error"; message: string };

export async function loadCaseActivityAction(
  caseId: number,
  page: number = 1,
): Promise<LoadCaseActivityResult> {
  try {
    const result = await getCaseActivityPage(caseId, page, CASE_ACTIVITY_PAGE_SIZE);
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
          : "Could not load activity for this case.",
    };
  }
}
