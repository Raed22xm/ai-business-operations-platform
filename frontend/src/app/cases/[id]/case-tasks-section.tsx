import { Suspense } from "react";
import { CaseTasksPanel } from "@/app/cases/[id]/case-tasks-panel";
import { getTasksForCase } from "@/lib/tasks";

export function CaseTasksSection({
  caseId,
  readOnly = false,
}: {
  caseId: number;
  readOnly?: boolean;
}) {
  return (
    <Suspense fallback={<CaseTasksLoading />}>
      <CaseTasksLoader caseId={caseId} readOnly={readOnly} />
    </Suspense>
  );
}

async function CaseTasksLoader({
  caseId,
  readOnly,
}: {
  caseId: number;
  readOnly: boolean;
}) {
  const result = await loadTasks(caseId);
  return (
    <CaseTasksPanel
      caseId={caseId}
      tasks={result.tasks}
      loadError={result.error}
      readOnly={readOnly}
    />
  );
}

function CaseTasksLoading() {
  return (
    <section aria-labelledby="case-tasks-heading" className="crm-section flex flex-col gap-4">
      <h2 id="case-tasks-heading" className="text-xl font-semibold tracking-tight">
        Tasks
      </h2>
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading tasks…
      </p>
    </section>
  );
}

async function loadTasks(caseId: number): Promise<{
  tasks: Awaited<ReturnType<typeof getTasksForCase>> | null;
  error: string | null;
}> {
  try {
    const tasks = await getTasksForCase(caseId);
    return { tasks, error: null };
  } catch {
    return {
      tasks: null,
      error: "Could not load tasks for this case. Check that the API is running, then try again.",
    };
  }
}
