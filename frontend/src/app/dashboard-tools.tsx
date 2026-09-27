"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import type { CustomerCase } from "@/lib/cases";

export function CasePicker({ cases, selectedId, customerId, search }: { cases: CustomerCase[]; selectedId: number; customerId: number; search?: string }) {
  const router = useRouter();
  return <select aria-label="Choose a case" className="case-picker" value={selectedId} onChange={(event) => {
    const params = new URLSearchParams({ customerId: String(customerId), caseId: event.target.value });
    if (search) params.set("q", search);
    router.push(`/?${params}`, { scroll: false });
  }}>{cases.map((work) => <option key={work.id} value={work.id}>{work.title}</option>)}</select>;
}

export function CopyBrief({ brief, disabled }: { brief: string; disabled: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return <div className="copy-brief"><button disabled={disabled} className="workspace-button small-button" onClick={async () => {
    try { await navigator.clipboard.writeText(brief); setState("copied"); }
    catch { setState("error"); }
  }}>{state === "copied" ? <Check size={13} /> : <Copy size={13} />}{state === "copied" ? "Copied" : "Copy brief"}</button><span role="status" className={state === "error" ? "copy-error" : "sr-only"}>{state === "copied" ? "Case brief copied." : state === "error" ? "Couldn’t copy. Try again." : ""}</span></div>;
}
