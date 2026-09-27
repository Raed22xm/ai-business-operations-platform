import Link from "next/link";
import { formatTaskDueDate, taskPriorityLabel, taskStatusLabel } from "@/lib/tasks-shared";
import type { TaskSearchItem } from "@/lib/tasks-workspace-shared";

export function TaskTable({
  tasks,
  filtered,
}: {
  tasks: TaskSearchItem[];
  filtered: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {filtered ? "No tasks match these filters." : "No tasks yet."}
      </p>
    );
  }

  return (
    <div className="crm-table-scroll">
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className="px-3 py-2 font-medium">
              Title
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Customer
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Case
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Priority
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Due date
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              className="border-b border-zinc-100 dark:border-zinc-900"
            >
              <td className="px-3 py-3">
                <Link
                  href={`/cases/${task.caseId}`}
                  className="font-medium text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
                >
                  {task.title}
                </Link>
                {task.isOverdue ? (
                  <span className="task-overdue-label ml-2">Overdue</span>
                ) : task.isDueToday ? (
                  <span className="task-due-today-label ml-2">Due today</span>
                ) : null}
              </td>
              <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                <Link
                  href={`/customers/${task.customerId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {task.customerName}
                </Link>
              </td>
              <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                <Link
                  href={`/cases/${task.caseId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {task.caseTitle}
                </Link>
              </td>
              <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                {taskStatusLabel(task.status)}
              </td>
              <td className="px-3 py-3">
                <span className="task-priority-label" data-priority={task.priority}>
                  {taskPriorityLabel(task.priority)}
                </span>
              </td>
              <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                {task.dueDate ? (
                  <time dateTime={task.dueDate}>{formatTaskDueDate(task.dueDate)}</time>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
