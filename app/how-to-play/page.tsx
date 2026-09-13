import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/client/components/site-shell";
export const metadata: Metadata = {
  title: "How to play",
  description: "Learn the supported rules and flow of Imposter Game.",
};
export default function HowToPlay() {
  return (
    <div className="marketing-page">
      <SiteHeader />
      <main id="main-content" className="article-page">
        <header>
          <p className="eyebrow">Field guide</p>
          <h1>How to play</h1>
          <p className="lead">
            One room. Secret roles. Real-world tasks. Evidence you can challenge.
          </p>
        </header>
        <section>
          <h2>1. Assemble your room</h2>
          <p>
            One player creates a room and shares its six-character code. Up to 12 adults can join
            without creating an account. The host chooses a published task pack and the supported
            timers, then starts when the server says the room is ready.
          </p>
        </section>
        <section>
          <h2>2. Read your private role</h2>
          <p>
            Your device reveals only your role. Crew finish their assigned tasks and upload proof.
            Imposters blend in, complete convincing fake assignments, and can eliminate living
            players when the server allows it. Never show your role screen to the room.
          </p>
        </section>
        <section>
          <h2>3. Complete and document tasks</h2>
          <p>
            Each player sees only their own assignments. Photo confirmation marks a task complete
            provisionally. The server processes the image; rejected media can reopen the task. Crew
            ghosts may still finish tasks when their capabilities allow it.
          </p>
        </section>
        <section>
          <h2>4. Meet when the room calls</h2>
          <p>
            A kill or task deadline starts a meeting. Talk face to face during discussion. Flagged
            photos may be reviewed one at a time. Living eligible players decide whether evidence is
            valid, then privately vote to eject or skip.
          </p>
        </section>
        <section>
          <h2>5. Follow the authoritative result</h2>
          <p>
            Votes can be replaced until the phase locks. Ties and skips may eject nobody. Individual
            ballots and other players’ roles stay private—even at game over. A completed room cannot
            be replayed; start a new one for another round.
          </p>
        </section>
        <aside className="rules-note">
          <h2>What this version does not do</h2>
          <p>
            There is no emergency meeting, in-app chat, player removal, timer extension after start,
            manual phase advancement, or same-room replay.
          </p>
        </aside>
        <Link className="button button-primary" href="/play">
          Start playing
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
