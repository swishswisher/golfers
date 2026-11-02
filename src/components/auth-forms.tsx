"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { post, resetCsrf } from "@/lib/api";
import {
  Action,
  Button,
  Card,
  CheckField,
  Field,
  Notice,
} from "@/components/ui";
type Mode =
  | "resend-verification"
  | "login"
  | "signup"
  | "verify"
  | "forgot-password"
  | "reset-password"
  | "invitation";
export function AuthForm({
  mode,
  params = {},
  demo = false,
}: {
  mode: Mode;
  params?: Record<string, string | undefined>;
  demo?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const d = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "login") {
        await post("/api/auth/login", { email: d.email, password: d.password });
        resetCsrf();
        const next = params.next || "/app";
        let destination = "/app";
        try {
          const u = new URL(next, window.location.origin);
          if (
            u.origin === window.location.origin &&
            next.startsWith("/") &&
            !next.startsWith("//")
          )
            destination = u.pathname + u.search;
        } catch {}
        window.location.assign(destination);
      }
      if (mode === "signup") {
        await post("/api/auth/register", {
          name: d.name,
          email: d.email,
          password: d.password,
        });
        setMessage(
          "Your account was created. Check your email for the confirmation link before signing in.",
        );
      }
      if (mode === "verify") {
        await post("/api/auth/verify", {
          userId: params.userId,
          token: params.token,
        });
        setMessage("Email confirmed. You can now sign in.");
      }
      if (mode === "resend-verification") {
        const r = await post<{ message: string }>(
          "/api/auth/resend-verification",
          { email: d.email },
        );
        setMessage(r.message);
      }
      if (mode === "forgot-password") {
        const r = await post<{ message: string }>("/api/auth/forgot-password", {
          email: d.email,
        });
        setMessage(r.message);
      }
      if (mode === "reset-password") {
        await post("/api/auth/reset-password", {
          email: params.email,
          token: params.token,
          password: d.password,
        });
        setMessage("Password changed. Sign in again on each device.");
      }
      if (mode === "invitation") {
        const r = await post<{ clubId: string }>("/api/invitations/accept", {
          token: params.token,
        });
        router.replace("/app/" + r.clubId);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const title = {
    "resend-verification": "Request a confirmation link.",
    login: "Sign in to your club.",
    signup: "Create your club account.",
    verify: "Confirm your email.",
    "forgot-password": "Reset your password.",
    "reset-password": "Choose a new password.",
    invitation: "Your club is waiting.",
  }[mode];
  return (
    <main id="main">
      <section className="auth card">
        <span className="eyebrow">A good club day starts here</span>
        <h1>{title}</h1>
        <p>
          {mode === "signup"
            ? "Create an account, confirm your email and start your club trial."
            : mode === "invitation"
              ? "Accept this invitation using the verified email account it was sent to."
              : "Your club, your people and your next activity."}
        </p>
        {message ? (
          <>
            <Notice>{message}</Notice>
            <Action href="/login">Sign in</Action>
          </>
        ) : (
          <form method="post" onSubmit={submit}>
            {mode === "signup" && (
              <Field
                label="Your name"
                name="name"
                autoComplete="name"
                required
                maxLength={160}
              />
            )}
            {[
              "login",
              "signup",
              "forgot-password",
              "resend-verification",
            ].includes(mode) && (
              <Field
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            )}
            {["login", "signup", "reset-password"].includes(mode) && (
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "login" ? 1 : 12}
                hint={
                  mode === "login"
                    ? undefined
                    : "At least 12 characters, with an uppercase letter, a number and a symbol."
                }
              />
            )}
            {mode === "signup" && (
              <div className="mt">
                <CheckField
                  label="I agree to the service terms and privacy notice."
                  required
                />
              </div>
            )}
            {error && (
              <div className="mt">
                <Notice kind="error">{error}</Notice>
              </div>
            )}
            <Button type="submit" className="mt" disabled={busy || !ready}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "verify"
                      ? "Confirm email"
                      : mode === "invitation"
                        ? "Accept invitation"
                        : mode === "forgot-password"
                          ? "Request reset instructions"
                          : mode === "resend-verification"
                            ? "Request confirmation link"
                            : "Change password"}
            </Button>
          </form>
        )}
        <div className="divider" />
        <div className="actions">
          {mode === "login" ? (
            <>
              <Link href="/forgot-password">Forgot your password?</Link>
              <Link href="/resend-verification">Resend email confirmation</Link>
              <Link href="/signup">Create an account</Link>
            </>
          ) : (
            <Link
              href={
                mode === "invitation"
                  ? "/login?next=" +
                    encodeURIComponent(
                      "/invitation?token=" + (params.token || ""),
                    )
                  : "/login"
              }
            >
              Return to sign in
            </Link>
          )}
        </div>
        {demo && mode === "login" && (
          <Card title="Isolated demonstration accounts" className="mt">
            <p className="small">
              Use manager, coach, treasurer, caterer, member, member2, guardian
              or platform @clubline.test. Password: ClublineDemo!2026. All club
              records are labelled as demonstrations.
            </p>
          </Card>
        )}
        {demo && (
          <div className="actions mt">
            <Link href="/development/inbox">Open local development inbox</Link>
          </div>
        )}
      </section>
    </main>
  );
}
