import Link from "next/link";
import { Icon } from "@/client/components/ui";
import { PhaseGlyph, SignalSceneArt } from "@/client/components/signal-visuals";
import { SiteFooter, SiteHeader } from "@/client/components/site-shell";

export default function Home() {
  return (
    <div className="marketing-page">
      <SiteHeader />
      <main id="main-content">
        <section className="hero signal-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />A live social deduction game
            </p>
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
              <Link className="button button-primary" href="/play">
                Start a room <Icon name="arrow" size={18} />
              </Link>
              <Link className="text-link" href="/how-to-play">
                See how it works <Icon name="arrow" size={17} />
              </Link>
            </div>
            <ul className="trust-row">
              <li>18+ private rooms</li>
              <li>Up to 12 players</li>
              <li>Photos auto-delete</li>
            </ul>
          </div>
          <div className="hero-visual">
            <SignalSceneArt scene="meeting" />
            <div className="hero-visual-note hero-visual-note-top">
              <Icon name="room" size={16} /> ROOM 7X3K9Q
            </div>
            <div className="hero-visual-note hero-visual-note-bottom">
              <span>LIVE</span> 6 players connected
            </div>
          </div>
        </section>
        <section className="steps-section journey-section" aria-labelledby="journey-title">
          <div className="section-intro">
            <div>
              <p className="eyebrow">The round, at a glance</p>
              <h2 id="journey-title">
                Play the room.
                <br />
                Not the screen.
              </h2>
            </div>
            <p className="section-kicker">
              Fast prompts on your phone. The real game happens face to face.
            </p>
          </div>
          <div className="journey-track">
            <article className="journey-card journey-lobby">
              <SignalSceneArt scene="lobby" compact />
              <div className="journey-card-copy">
                <span>01</span>
                <PhaseGlyph scene="lobby" />
                <h3>Gather the room</h3>
                <p>Create a private room, share one code, and get everyone ready.</p>
              </div>
            </article>
            <article className="journey-card journey-tasks">
              <SignalSceneArt scene="tasks" compact />
              <div className="journey-card-copy">
                <span>02</span>
                <PhaseGlyph scene="tasks" />
                <h3>Prove your work</h3>
                <p>Finish real-world tasks and add private photo evidence.</p>
              </div>
            </article>
            <article className="journey-card journey-meeting">
              <SignalSceneArt scene="meeting" compact />
              <div className="journey-card-copy">
                <span>03</span>
                <PhaseGlyph scene="meeting" />
                <h3>Read the table</h3>
                <p>Challenge suspicious proof and make your case out loud.</p>
              </div>
            </article>
            <article className="journey-card journey-verdict">
              <SignalSceneArt scene="verdict" compact />
              <div className="journey-card-copy">
                <span>04</span>
                <PhaseGlyph scene="verdict" />
                <h3>Cast the verdict</h3>
                <p>Vote in private, reveal the result, and live with the room’s decision.</p>
              </div>
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
          <div className="phase-swatches" aria-label="The four game phases">
            <span className="swatch-lobby">
              <Icon name="lobby" />
              LOBBY
            </span>
            <span className="swatch-tasks">
              <Icon name="tasks" />
              TASKS
            </span>
            <span className="swatch-meeting">
              <Icon name="meeting" />
              MEETING
            </span>
            <span className="swatch-results">
              <Icon name="verdict" />
              RESULTS
            </span>
          </div>
        </section>
        <section className="privacy-callout">
          <div className="seal-large" aria-hidden="true">
            <Icon name="eye" size={34} />
          </div>
          <div>
            <p className="eyebrow">Your room stays your room</p>
            <h2>Evidence without the surveillance.</h2>
            <p>
              Photos are visible only to your game room and are scheduled for deletion after the
              game. No public profiles, no session replay, no ad trackers on game screens.
            </p>
            <Link className="text-link" href="/privacy-and-photos">
              Read the photo policy <Icon name="arrow" size={17} />
            </Link>
          </div>
          <Link className="button button-primary" href="/play">
            Open a case <Icon name="arrow" size={18} />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
