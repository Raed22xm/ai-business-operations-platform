import { apiFetch } from "@/lib/api";

function apiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "Missing API_BASE_URL. Set it in frontend/.env.local, for example http://localhost:5222.",
    );
  }

  return baseUrl.replace(/\/$/, "");
}

export async function proxyCsvExport(
  backendPath: string,
  request: Request,
): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(`${apiBaseUrl()}${backendPath}`);
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  let upstream: Response;
  try {
    upstream = await apiFetch(target.toString(), {
      headers: { Accept: "text/csv" },
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { title: "Export unavailable", detail: "Could not reach the API to export CSV." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const contentType = upstream.headers.get("Content-Type") ?? "application/json";
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "text/csv; charset=utf-8");
  const disposition = upstream.headers.get("Content-Disposition");
  if (disposition) {
    headers.set("Content-Disposition", disposition);
  }
  headers.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
