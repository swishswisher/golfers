"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Overview" },
  { href: "/mvp", label: "MVP scope" },
  { href: "/stack", label: "Tech & architecture" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/5 bg-sand-100/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow-card">
              <span className="text-sm font-semibold">G</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-ink-900">
                Golfers Clubline
              </span>
              <span className="text-[11px] text-black/60">
                Golf club engagement MVP
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-black/70 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "transition-colors " +
                  (isActive(link.href)
                    ? "text-ink-900"
                    : "hover:text-ink-900")
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/demo"
              className="rounded-full border border-brand-500/30 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:border-brand-500 hover:bg-brand-50"
            >
              View live MVP demo
            </Link>
            <button className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-brand-600">
              Book a 15-min walkthrough
            </button>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white p-2 text-black/80 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
          >
            <span className="sr-only">Open navigation menu</span>
            <div className="space-y-1">
              <span className="block h-[2px] w-4 bg-black/80" />
              <span className="block h-[2px] w-4 bg-black/80" />
            </div>
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="absolute right-0 top-0 flex h-full w-64 flex-col bg-sand-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">
                Golfers Clubline
              </span>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black/80"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
              >
                <span className="sr-only">Close</span>
                �
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-4 py-4 text-sm font-medium text-black/80">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={
                    "rounded-xl px-3 py-2 " +
                    (isActive(link.href)
                      ? "bg-brand-100 text-ink-900"
                      : "hover:bg-black/5")
                  }
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/demo"
                onClick={() => setOpen(false)}
                className={
                  "mt-2 rounded-xl px-3 py-2 " +
                  (pathname.startsWith("/demo")
                    ? "bg-brand-100 text-brand-800"
                    : "bg-brand-500 text-white hover:bg-brand-600")
                }
              >
                Live MVP demo
              </Link>
            </nav>
            <div className="border-t border-black/5 px-4 py-4">
              <button className="w-full rounded-full border border-brand-500/30 bg-white px-4 py-2 text-xs font-medium text-brand-700 hover:border-brand-500 hover:bg-brand-50">
                Book a 15-min walkthrough
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

