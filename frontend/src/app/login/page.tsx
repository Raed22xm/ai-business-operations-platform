import { Aperture } from "lucide-react";
import { LoginForm } from "@/app/login/login-form";

export const metadata = {
  title: "Sign in",
};

type Search = { next?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const query = await searchParams;
  const nextPath =
    query.next && query.next.startsWith("/") && !query.next.startsWith("//")
      ? query.next
      : "/";

  return (
    <main className="login-page" aria-labelledby="login-heading">
      <div className="login-card">
        <div className="login-brand">
          <Aperture size={32} strokeWidth={2.3} aria-hidden="true" />
          <div>
            <p className="login-product">Operations Hub</p>
            <h1 id="login-heading">Sign in</h1>
          </div>
        </div>
        <p className="login-copy">
          Access your private workspace. There is no public registration.
        </p>
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
