import type { Metadata } from "next";
import { PlayForm } from "@/client/components/play-form";
import { PlayAccessGate } from "@/client/components/play-access-gate";
import { SiteHeader } from "@/client/components/site-shell";
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
        <PlayAccessGate>
          <PlayForm />
        </PlayAccessGate>
      </main>
    </div>
  );
}
