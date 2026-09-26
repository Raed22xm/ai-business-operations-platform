export type CustomerField = "name" | "email" | "phone" | "company";

export type CustomerFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  fieldErrors: Partial<Record<CustomerField, string>>;
  revision: number;
};

export const initialCustomerFormState: CustomerFormState = {
  status: "idle",
  message: null,
  formError: null,
  fieldErrors: {},
  revision: 0,
};

export type DeleteCustomerState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  customerId: number | null;
};

export const initialDeleteCustomerState: DeleteCustomerState = {
  status: "idle",
  message: null,
  formError: null,
  customerId: null,
};
