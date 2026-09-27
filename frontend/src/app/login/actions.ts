"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, loginWithPassword } from "@/lib/auth";

export type LoginFormState = {
  status: "idle" | "error";
  message: string | null;
};

export async function loginAction(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return {
      status: "error",
      message: "Enter your username and password.",
    };
  }

  const result = await loginWithPassword(username, password);
  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  const next = String(formData.get("next") ?? "").trim();
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  try {
    const baseUrl = process.env.API_BASE_URL?.trim();
    if (baseUrl) {
      await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/logout`, {
        method: "POST",
        cache: "no-store",
      });
    }
  } catch {
    // Cookie clear is enough for logout UX.
  }
  redirect("/login");
}
