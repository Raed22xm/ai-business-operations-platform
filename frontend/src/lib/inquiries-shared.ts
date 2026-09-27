export type CustomerMatch = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  createdAt: string;
};

export type ResolveCustomerResponse = {
  queryEmail: string;
  matches: CustomerMatch[];
  hasExactMatch: boolean;
  hasMultipleMatches: boolean;
};

export type CreateInquiryRequest = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  customerCompany?: string | null;
  selectedCustomerId?: number | null;
  confirmCreateNew?: boolean;
  title: string;
  description?: string | null;
};

export type CreateInquiryResponse = {
  caseId: number;
  customerId: number;
  customerName: string;
  caseTitle: string;
  isNewCustomer: boolean;
  createdAt: string;
};

export type InquiryField =
  | "customerName"
  | "customerEmail"
  | "customerPhone"
  | "customerCompany"
  | "selectedCustomerId"
  | "title"
  | "description";

export type InquiryFormValues = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  selectedCustomerId: string;
  confirmCreateNew: boolean;
  title: string;
  description: string;
};

export const emptyInquiryValues: InquiryFormValues = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerCompany: "",
  selectedCustomerId: "",
  confirmCreateNew: false,
  title: "",
  description: "",
};

export type InquiryFormState = {
  status: "idle" | "error" | "success";
  message: string | null;
  formError: string | null;
  fieldErrors: Partial<Record<InquiryField, string>>;
  conflictType?: "CustomerMatchRequired" | "DuplicateInquiry" | null;
  conflictMatches?: CustomerMatch[];
  values: InquiryFormValues;
  savedCaseId?: number | null;
  savedCustomerId?: number | null;
  revision: number;
};

export const initialInquiryFormState: InquiryFormState = {
  status: "idle",
  message: null,
  formError: null,
  fieldErrors: {},
  conflictType: null,
  conflictMatches: undefined,
  values: emptyInquiryValues,
  savedCaseId: null,
  savedCustomerId: null,
  revision: 0,
};
