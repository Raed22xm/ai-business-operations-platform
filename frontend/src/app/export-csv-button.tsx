"use client";

import { useState } from "react";

type ExportCsvButtonProps = {
  href: string;
  /** Short label describing what is exported (for aria / messages). */
  resourceLabel: string;
};

export function ExportCsvButton({ href, resourceLabel }: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(href, {
        method: "GET",
        headers: { Accept: "text/csv" },
        cache: "no-store",
      });

      if (!response.ok) {
        setError(await readExportError(response, resourceLabel));
        return;
      }

      const blob = await response.blob();
      const filename =
        filenameFromDisposition(response.headers.get("Content-Disposition")) ??
        `${resourceLabel.toLowerCase()}-export.csv`;
      const objectUrl = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setError(`Could not export ${resourceLabel.toLowerCase()}. Check that the API is running.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          void handleExport();
        }}
        disabled={loading}
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        aria-busy={loading}
      >
        {loading ? "Exporting…" : "Export CSV"}
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Downloads all {resourceLabel.toLowerCase()} matching the current filters (not only this page).
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

async function readExportError(response: Response, resourceLabel: string): Promise<string> {
  const fallback = `Could not export ${resourceLabel.toLowerCase()} (${response.status}).`;
  try {
    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json") || contentType.includes("problem+json")) {
      const body: unknown = await response.json();
      if (body && typeof body === "object") {
        const detail = "detail" in body && typeof body.detail === "string" ? body.detail : null;
        const title = "title" in body && typeof body.title === "string" ? body.title : null;
        if (detail) {
          return detail;
        }
        if (title) {
          return title;
        }
      }
    }
  } catch {
    // Fall through to status-based message.
  }

  if (response.status === 401) {
    return "Sign in again to export.";
  }

  return fallback;
}
