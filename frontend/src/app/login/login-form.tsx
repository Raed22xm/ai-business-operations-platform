"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/login/actions";

const initial: LoginFormState = { status: "idle", message: null };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form
      action={action}
      className="login-form"
      aria-describedby={state.message ? "login-error" : undefined}
    >
      <input type="hidden" name="next" value={nextPath} />
      <label className="login-field">
        <span>Username</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          disabled={pending}
        />
      </label>
      <label className="login-field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </label>
      {state.message ? (
        <p id="login-error" className="login-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        className="workspace-button is-primary login-submit"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
