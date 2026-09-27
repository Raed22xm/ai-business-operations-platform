export type CustomerNoteField = "content";

export type CustomerNoteFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  fieldErrors: Partial<Record<CustomerNoteField, string>>;
  revision: number;
  noteId: number | null;
};

export const initialCustomerNoteFormState: CustomerNoteFormState = {
  status: "idle",
  message: null,
  formError: null,
  fieldErrors: {},
  revision: 0,
  noteId: null,
};

export type DeleteCustomerNoteState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  noteId: number | null;
};

export const initialDeleteCustomerNoteState: DeleteCustomerNoteState = {
  status: "idle",
  message: null,
  formError: null,
  noteId: null,
};
