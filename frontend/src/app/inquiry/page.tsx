import Link from "next/link";
import { ArrowLeft, Inbox, ShieldCheck } from "lucide-react";
import { InquiryForm } from "@/app/inquiry/inquiry-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Customer Inquiry",
};

export default function InquiryPage() {
  return (
    <main className="crm-page" aria-label="Customer Inquiry Intake">
      <div className="crm-page-heading">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
          <Link
            href="/cases"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to cases</span>
          </Link>
          <span className="text-zinc-600">/</span>
          <span>Intake</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
              <Inbox className="size-7 text-emerald-400" aria-hidden="true" />
              <span>New Customer Inquiry</span>
            </h1>
            <p className="text-sm md:text-base text-zinc-400 max-w-3xl">
              Turn an incoming customer inquiry into a verified customer profile and an open case with full transactional integrity and audit tracking.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-800/40 bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-300">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>Internal Workspace Intake</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl">
        <InquiryForm />
      </div>
    </main>
  );
}
