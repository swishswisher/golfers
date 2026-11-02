"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import type { Club } from "@/lib/contracts";
import {
  Action,
  Button,
  Card,
  CheckField,
  Field,
  Notice,
  Select,
} from "@/components/ui";
export function OnboardingForm() {
  const router = useRouter(),
    [step, setStep] = useState(1),
    [club, setClub] = useState<Club | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (step === 1) {
        const created = await post<Club>("/api/clubs", {
          name: d.name,
          country: d.country,
          currency: d.currency,
          timeZone: d.timeZone,
          brandColor: d.brandColor,
          sports: String(d.sports)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        });
        setClub(created);
        setStep(2);
        router.refresh();
      } else if (step === 2) setStep(3);
      else if (step === 3) {
        if (d.email) {
          await post("/api/clubs/" + club!.id + "/invitations", {
            email: d.email,
            role: d.role,
          });
          setNotice(
            "Invitation recorded and queued. Delivery can be checked from the club workspace.",
          );
        }
        setStep(4);
      } else router.push("/app/" + club!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="onboard">
      <aside className="onboard-side">
        <span className="eyebrow">Your club starts here</span>
        {["Club & sports", "Your members", "Your staff", "Plan & launch"].map(
          (t, i) => (
            <div
              key={t}
              className={"onboard-step " + (step === i + 1 ? "current" : "")}
            >
              <i>{step > i + 1 ? "✓" : i + 1}</i>
              <span>{t}</span>
            </div>
          ),
        )}
        <p className="small mt">
          Each completed step is saved. You can return through your club
          workspace.
        </p>
      </aside>
      <section className="onboard-main">
        <span className="eyebrow">Step {step} of 4</span>
        <h1>
          {
            [
              "Let’s make it your club.",
              "Bring your people along.",
              "The right tools for your team.",
              "Ready for your first club day.",
            ][step - 1]
          }
        </h1>
        <p>Set up your sports club at your pace.</p>
        <form method="post" onSubmit={submit}>
          {step === 1 && (
            <Card>
              <div className="formgrid">
                <Field label="Club name" name="name" required maxLength={160} />
                <Field
                  label="Sports, separated by commas"
                  name="sports"
                  defaultValue="Football, Tennis"
                  required
                  hint="Use any sports or activity names your club needs."
                />
                <Field
                  label="Country code"
                  name="country"
                  defaultValue="KE"
                  required
                  pattern="[A-Za-z]{2}"
                  hint="Two-letter country code, for example KE, GB, US or ZA."
                />
                <Field
                  label="Currency"
                  name="currency"
                  defaultValue="KES"
                  pattern="[A-Za-z]{3}"
                  required
                />
                <Field
                  label="Club time zone"
                  name="timeZone"
                  defaultValue={
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                  }
                  required
                  hint="Use an IANA name, such as Africa/Nairobi or Europe/London."
                />
                <Field
                  label="Brand colour"
                  name="brandColor"
                  type="color"
                  defaultValue="#235c45"
                />
              </div>
            </Card>
          )}
          {step === 2 && (
            <Card title="Your club workspace is ready.">
              <p>
                Add members individually, or preview and validate a CSV before
                importing it. Importing records does not automatically send
                invitations.
              </p>
              <div className="actions">
                <Action href={"/app/" + club?.id + "/members"} kind="secondary">
                  Open member management
                </Action>
              </div>
              <p className="small mt">
                You can complete the import in the workspace and return here, or
                continue with a small team first.
              </p>
            </Card>
          )}
          {step === 3 && (
            <Card>
              <div className="formgrid">
                <Field
                  label="Staff email (optional)"
                  name="email"
                  type="email"
                />
                <Select label="Role" name="role">
                  {[
                    "Coach",
                    "Treasurer",
                    "ProShop",
                    "Caterer",
                    "Manager",
                    "Member",
                    "Guardian",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </div>
              <p className="small mt">
                The invitee verifies their email and accepts the invitation
                before receiving access.
              </p>
            </Card>
          )}
          {step === 4 && (
            <>
              <Notice>
                Your club has a 14-day trial. No payment has been taken.
              </Notice>
              <Card title={club?.name}>
                <p>
                  {club?.country} · {club?.currency} · {club?.timeZone}
                </p>
                <p>
                  Paid subscriptions and supported merchant payments are
                  configured separately. Review availability from your
                  subscription screen.
                </p>
                <div className="actions">
                  <Action
                    href={"/app/" + club?.id + "/billing"}
                    kind="secondary"
                  >
                    Review subscription
                  </Action>
                </div>
              </Card>
              <CheckField label="I have reviewed my club setup." required />
            </>
          )}
          {notice && (
            <div className="mt">
              <Notice>{notice}</Notice>
            </div>
          )}
          {error && (
            <div className="mt">
              <Notice kind="error">{error}</Notice>
            </div>
          )}
          <div className="actions mt">
            <Button disabled={busy} type="submit">
              {busy
                ? "Saving…"
                : step === 1
                  ? "Create club & trial"
                  : step === 4
                    ? "Open my club"
                    : "Continue"}
            </Button>
            {club && (
              <Action href={"/app/" + club.id} kind="ghost">
                Save and return to club
              </Action>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
