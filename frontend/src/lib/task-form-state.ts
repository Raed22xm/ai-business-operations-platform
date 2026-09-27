export type TaskField = "title" | "description" | "dueDate" | "status" | "priority";

export type TaskFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  fieldErrors: Partial<Record<TaskField, string>>;
  revision: number;
  taskId: number | null;
};

export const initialTaskFormState: TaskFormState = {
  status: "idle",
  message: null,
  formError: null,
  fieldErrors: {},
  revision: 0,
  taskId: null,
};

export type DeleteTaskState = {
  status: "idle" | "success" | "error";
  message: string | null;
  formError: string | null;
  taskId: number | null;
};

export const initialDeleteTaskState: DeleteTaskState = {
  status: "idle",
  message: null,
  formError: null,
  taskId: null,
};
