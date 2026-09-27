"use client";

type TasksErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function TasksError({ retry }: TasksErrorProps) {
  return (
    <main className="crm-page">
      <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
      <p role="alert" className="text-red-700 dark:text-red-400">
        Could not load tasks. Check that the API is running, then try again.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="w-fit rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
