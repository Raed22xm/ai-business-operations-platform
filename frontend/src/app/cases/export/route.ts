import { proxyCsvExport } from "@/lib/csv-export";

export async function GET(request: Request): Promise<Response> {
  return proxyCsvExport("/api/cases/export", request);
}
