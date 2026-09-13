import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/client/components/site-shell";
export const metadata: Metadata = {
  title: "Privacy and photos",
  description: "Photo consent, age, visibility, and retention information for Imposter Game.",
};
export default function Privacy() {
  return (
    <div className="marketing-page">
      <SiteHeader />
      <main id="main-content" className="article-page">
        <header>
          <p className="eyebrow">Privacy briefing</p>
          <h1>Photos stay inside the room.</h1>
          <p className="lead">
            Imposter Game is for adults aged 18 and over. Everyone should understand and agree
            before a room starts.
          </p>
        </header>
        <section>
          <h2>Before you upload</h2>
          <ul className="plain-list">
            <li>Ask permission before including another person in a photo.</li>
            <li>Use the camera or file-picker path that works for you.</li>
            <li>Avoid documents, screens, addresses, and other sensitive details.</li>
            <li>Only submit evidence needed for the task.</li>
          </ul>
        </section>
        <section>
          <h2>Who can see evidence</h2>
          <p>
            Evidence is available only to authorized participants in your current room and only
            during supported game phases. Signed image links are short-lived and remain in memory;
            the web client does not store them in browser persistence.
          </p>
        </section>
        <section>
          <h2>Processing and retention</h2>
          <p>
            Uploads are normalized for safety and may be rejected if they are unsupported or fail
            processing. Evidence is scheduled for automatic deletion after the game under the
            server’s current 24-hour retention policy. The exact notice returned with an upload
            request is shown again before submission.
          </p>
        </section>
        <section>
          <h2>What the browser does not keep</h2>
          <p>
            Your participant credential lives in a Secure, HttpOnly, SameSite cookie that website
            JavaScript cannot read. Authenticated game responses and evidence images are not cached
            by a service worker. Game and admin screens do not use third-party analytics or session
            replay.
          </p>
        </section>
        <p className="muted">
          This product notice explains current behavior. Final public legal language requires
          launch-owner approval.
        </p>
        <Link className="button button-primary" href="/play">
          I understand — continue
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
