import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/client/components/site-shell";
import { Icon } from "@/client/components/ui";
import { SignalSceneArt } from "@/client/components/signal-visuals";
export const metadata: Metadata = {
  title: "Privacy and photos",
  description: "Photo consent, age, visibility, and retention information for Imposter Game.",
};
export default function Privacy() {
  return (
    <div className="marketing-page">
      <SiteHeader />
      <main id="main-content" className="article-page">
        <header className="article-hero">
          <div>
            <p className="eyebrow">Privacy briefing</p>
            <h1>Photos stay inside the room.</h1>
            <p className="lead">
              Imposter Game is for adults aged 18 and over. Everyone should understand and agree
              before a room starts.
            </p>
          </div>
          <SignalSceneArt scene="verdict" compact />
        </header>
        <nav className="article-jump-nav" aria-label="Jump to privacy information">
          <a href="#photo-lifecycle">Photo lifecycle</a>
          <a href="#before-upload">Before upload</a>
          <a href="#visibility">Visibility</a>
          <a href="#retention">Retention</a>
          <a href="#browser-storage">Browser storage</a>
        </nav>
        <section className="privacy-lifecycle" aria-labelledby="photo-lifecycle">
          <div>
            <Icon name="camera" />
            <span>1</span>
            <strong>Capture</strong>
            <small>Only the proof the task needs.</small>
          </div>
          <div>
            <Icon name="room" />
            <span>2</span>
            <strong>Share privately</strong>
            <small>Authorized room members only.</small>
          </div>
          <div>
            <Icon name="evidence" />
            <span>3</span>
            <strong>Review</strong>
            <small>Short-lived links during the game.</small>
          </div>
          <div>
            <Icon name="check" />
            <span>4</span>
            <strong>Delete</strong>
            <small>Scheduled automatically after play.</small>
          </div>
          <h2 id="photo-lifecycle" className="sr-only">
            Photo lifecycle
          </h2>
        </section>
        <section id="before-upload">
          <h2>Before you upload</h2>
          <ul className="plain-list">
            <li>Ask permission before including another person in a photo.</li>
            <li>Use the camera or file-picker path that works for you.</li>
            <li>Avoid documents, screens, addresses, and other sensitive details.</li>
            <li>Only submit evidence needed for the task.</li>
          </ul>
        </section>
        <section id="visibility">
          <h2>Who can see evidence</h2>
          <p>
            Evidence is available only to authorized participants in your current room and only
            during supported game phases. Signed image links are short-lived and remain in memory;
            the web client does not store them in browser persistence.
          </p>
        </section>
        <section id="retention">
          <h2>Processing and retention</h2>
          <p>
            Uploads are normalized for safety and may be rejected if they are unsupported or fail
            processing. Evidence is scheduled for automatic deletion after the game under the
            server’s current 24-hour retention policy. The exact notice returned with an upload
            request is shown again before submission.
          </p>
        </section>
        <section id="browser-storage">
          <h2>What the browser does not keep</h2>
          <p>
            Your participant credential lives in a Secure, HttpOnly, SameSite cookie that website
            JavaScript cannot read. Authenticated game responses and evidence images are not cached
            by a service worker. Game and admin screens do not use third-party analytics or session
            replay.
          </p>
          <p>
            Optional player accounts retain profile details and game-result metadata so signed-in
            players can rejoin rooms and review history. Evidence photos are never copied into the
            dashboard and still follow the deletion schedule. Deleting an account removes its login
            and unlinks its game identities from the account.
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
