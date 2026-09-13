import Link from "next/link";
import { Brand, Button } from "@/client/components/ui";
import { SiteFooter, SiteHeader } from "@/client/components/site-shell";

export default function Home() {
  return (
    <div className="marketing-page">
      <SiteHeader />
      <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">A live social deduction game</p>
            <h1>
              Everyone’s watching.
              <br />
              <span>Someone’s lying.</span>
            </h1>
            <p className="lead">
              Turn any hangout into a case of trust, bluffing, and photo-proof tasks. No download.
              No accounts. One room code.
            </p>
            <div className="hero-actions">
              <Link href="/play">
                <Button tabIndex={-1}>Start a room</Button>
              </Link>
              <Link className="text-link" href="/how-to-play">
                See how it works <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="trust-row">
              <li>18+ private rooms</li>
              <li>Up to 12 players</li>
              <li>Photos auto-delete</li>
            </ul>
          </div>
          <div className="hero-dossier" aria-label="Illustration of a confidential game dossier">
            <div className="dossier-tab">ROOM 7X3K9Q</div>
            <div className="dossier-paper">
              <span className="case-label">CASE FILE / ACTIVE</span>
              <Brand compact />
              <div className="redacted-lines">
                <i />
                <i />
                <i />
              </div>
              <div className="evidence-stamp">
                TRUST
                <br />
                NO ONE
              </div>
              <div className="paper-note">
                PROVE
                <br />
                EVERYTHING.
              </div>
            </div>
          </div>
        </section>
        <section className="steps-section">
          <div className="section-intro">
            <p className="eyebrow">Three moves. One liar.</p>
            <h2>
              Play the room,
              <br />
              not the screen.
            </h2>
          </div>
          <div className="steps-grid">
            <article>
              <span>01</span>
              <h3>Gather the room</h3>
              <p>Create a private room, share the code, and choose a task pack.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Prove your work</h3>
              <p>Complete real-world tasks and submit private-room photo evidence.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Read the table</h3>
              <p>Meet face to face, review disputed proof, and vote without exposing ballots.</p>
            </article>
          </div>
        </section>
        <section className="signal-band">
          <div>
            <p className="eyebrow">Built for the glance</p>
            <h2>
              Look down for two seconds.
              <br />
              Look back at your friends.
            </h2>
          </div>
          <div className="phase-swatches">
            <span className="swatch-lobby">LOBBY</span>
            <span className="swatch-tasks">TASKS</span>
            <span className="swatch-meeting">MEETING</span>
            <span className="swatch-results">RESULTS</span>
          </div>
        </section>
        <section className="privacy-callout">
          <div className="seal-large" aria-hidden="true">
            ◉
          </div>
          <div>
            <p className="eyebrow">Your room stays your room</p>
            <h2>Evidence without the surveillance.</h2>
            <p>
              Photos are visible only to your game room and are scheduled for deletion after the
              game. No public profiles, no session replay, no ad trackers on game screens.
            </p>
            <Link href="/privacy-and-photos">Read the photo policy →</Link>
          </div>
          <Link href="/play">
            <Button tabIndex={-1}>Open a case</Button>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
