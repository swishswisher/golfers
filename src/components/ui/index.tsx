import Link from "next/link";
import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { ArrowRight, Check } from "lucide-react";
export function Brand() {
  return (
    <Link className="wordmark" href="/">
      <span className="mark" aria-hidden="true" />
      clubline<span style={{ color: "var(--green)" }}>.</span>
    </Link>
  );
}
export function Button({
  children,
  kind = "",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: string }) {
  return (
    <button {...props} className={`btn ${kind} ${className}`}>
      {children}
    </button>
  );
}
export function Action({
  href,
  children,
  kind = "",
}: {
  href: string;
  children: ReactNode;
  kind?: string;
}) {
  return (
    <Link className={`btn ${kind}`} href={href}>
      {children}
      {kind === "lime" && <ArrowRight size={17} aria-hidden="true" />}
    </Link>
  );
}
export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="cardhead">
          <h2 style={{ fontSize: 18 }}>{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}
export function Notice({
  children,
  kind = "",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Check size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Badge({
  children,
  kind = "",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div className="field">
      <label>
        {label}
        <input {...props} />
      </label>
      {hint && <p>{hint}</p>}
    </div>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label}
        <select {...props}>{children}</select>
      </label>
    </div>
  );
}
export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div className="field full">
      <label>
        {label}
        <textarea {...props} />
      </label>
    </div>
  );
}
export function CheckField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="checkrow">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function DataTable({
  heads,
  rows,
  empty = "No records yet.",
}: {
  heads: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  return (
    <div
      className="tablewrap"
      tabIndex={0}
      role="region"
      aria-label={heads[0] + " records"}
    >
      <table>
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th key={i} scope="col">
                {h || "Actions"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={heads.length} className="data-empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <h2>{title}</h2>
      <p className="mt">{children}</p>
    </Card>
  );
}
export function CourtArt({ sport = "Tennis" }: { sport?: string }) {
  return (
    <svg
      viewBox="0 0 500 340"
      role="img"
      aria-label={`Illustration of ${sport.toLowerCase()} club activities`}
    >
      <rect width="500" height="340" fill="#e0e9cd" />
      <circle cx="470" cy="5" r="120" fill="#d0dda8" />
      {sport === "Football" ? (
        <>
          <rect
            x="95"
            y="55"
            width="300"
            height="230"
            fill="#4d8060"
            stroke="#c7dfb6"
            strokeWidth="2"
          />
          <path
            d="M245 55v230M95 110h60v120H95m300-120h-60v120h60"
            fill="none"
            stroke="#c7dfb6"
            strokeWidth="2"
          />
          <circle
            cx="245"
            cy="170"
            r="38"
            fill="none"
            stroke="#c7dfb6"
            strokeWidth="2"
          />
        </>
      ) : sport === "Swimming" ? (
        <>
          <rect x="85" y="50" width="330" height="240" fill="#5d9fb5" rx="9" />
          <path
            d="M90 95h320M90 135h320M90 175h320M90 215h320M90 255h320"
            stroke="#e6f5f0"
            strokeWidth="3"
            strokeDasharray="8 7"
          />
        </>
      ) : (
        <>
          <rect x="115" y="30" width="260" height="280" rx="4" fill="#719067" />
          <rect
            x="135"
            y="55"
            width="220"
            height="230"
            fill="none"
            stroke="#e8f0ca"
            strokeWidth="2"
          />
          <path
            d="M135 170h220M155 55v230M335 55v230M155 110h180m-180 120h180M245 110v120"
            fill="none"
            stroke="#e8f0ca"
            strokeWidth="2"
          />
          <path d="M125 169h240" stroke="#173b30" strokeWidth="5" />
        </>
      )}
      <circle cx="205" cy="235" r="10" fill="#15382f" />
      <circle cx="288" cy="110" r="10" fill="#d8ef88" />
      <circle cx="390" cy="290" r="32" fill="#e6a27a" />
    </svg>
  );
}
