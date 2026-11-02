"use client";
import { useState, type FormEvent } from "react";
import { post } from "@/lib/api";
import {
  Button,
  Card,
  CheckField,
  Field,
  Notice,
  Select,
  TextArea,
} from "@/components/ui";
export function EnquiryForm({
  kind,
  clubId,
}: {
  kind: "Demo" | "Contact" | "Trial" | "Membership";
  clubId?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await post<{ message: string }>("/api/public/enquiries", {
        name: form.get("name"),
        email: form.get("email"),
        body: form.get("body"),
        consent: form.get("consent") === "on",
        kind: kind === "Membership" ? form.get("requestKind") || kind : kind,
        clubId,
      });
      setSuccess(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      {success ? (
        <Notice>{success}</Notice>
      ) : (
        <form method="post" onSubmit={submit}>
          <div className="formgrid">
            {kind === "Membership" && (
              <Select label="I am interested in" name="requestKind">
                <option value="Membership">Club membership</option>
                <option value="Trial">Trying an activity</option>
              </Select>
            )}
            <Field
              label="Your name"
              name="name"
              autoComplete="name"
              required
              maxLength={160}
            />
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
            <TextArea
              label={
                kind === "Trial" || kind === "Membership"
                  ? "Tell us about the participant and preferred activity"
                  : "Tell us about your club and what you need"
              }
              name="body"
              required
              maxLength={4000}
            />
          </div>
          <div className="mt">
            <CheckField
              label="I agree to be contacted about this enquiry."
              name="consent"
              required
            />
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          <Button type="submit" disabled={busy}>
            {busy
              ? "Saving enquiry…"
              : kind === "Trial"
                ? "Request a trial"
                : kind === "Demo"
                  ? "Request a demo"
                  : "Send enquiry"}
          </Button>
        </form>
      )}
    </Card>
  );
}
