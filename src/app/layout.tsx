import type { Metadata } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa-registration";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: {
    default: "Clubline — More time for the sport.",
    template: "%s · Clubline",
  },
  description:
    "Memberships, teams, coaching, bookings and communication for sports clubs worldwide.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Clubline" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
