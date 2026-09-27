export type CaseField = "customerId" | "title" | "description" | "status";

export type CaseFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  fieldErrors: Partial<Record<CaseField, string>>;
  revision: number;
  customerId: number | null;
};

export const initialCaseFormState: CaseFormState = {
  status: "idle",
  message: null,
  formError: null,
  fieldErrors: {},
  revision: 0,
  customerId: null,
};

export type DeleteCaseState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  caseId: number | null;
};

export const initialDeleteCaseState: DeleteCaseState = {
  status: "idle",
  message: null,
  formError: null,
  caseId: null,
};
