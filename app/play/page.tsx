import type { Metadata } from "next";
import { PlayForm } from "@/client/components/play-form";
import { SiteHeader } from "@/client/components/site-shell";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Create or join",
  robots: { index: false, follow: false },
};
export default function Play() {
  return (
    <div className="funnel-page">
      <SiteHeader minimal backHref="/" backLabel="Back home" />
      <main id="main-content">
        <header>
          <p className="eyebrow">Enter the room</p>
          <h1>How are you playing?</h1>
          <p>It takes one code. Accounts are optional.</p>
        </header>
        <PlayForm />
        <p className="account-switch">
          Playing as a guest? <Link href="/register">Create an optional account</Link> to save
          results and rejoin rooms.
        </p>
      </main>
    </div>
  );
}
