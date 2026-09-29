"use server";

import { revalidatePath } from "next/cache";
import { updateTaskStatus, type TaskStatus } from "@/lib/tasks";

export async function updateTaskStatusAction(
  taskId: number,
  status: TaskStatus,
): Promise<{ status: "success"; message: string } | { status: "error"; message: string }> {
  const result = await updateTaskStatus(taskId, status);
  if (result.status === "success") {
    revalidatePath("/tasks");
    revalidatePath("/");
    return {
      status: "success",
      message: result.message ?? "Task status updated.",
    };
  }

  return {
    status: "error",
    message: result.formError ?? "Could not update task status.",
  };
}
