import Link from "next/link";
import { SignalSceneArt } from "@/client/components/signal-visuals";
export default function NotFound() {
  return (
    <main className="route-state">
      <div className="route-state-art">
        <SignalSceneArt scene="verdict" compact />
      </div>
      <span className="route-state-code">404</span>
      <h1>Case file not found.</h1>
      <p>This page may have moved or never existed.</p>
      <Link className="button button-primary" href="/">
        Return home
      </Link>
    </main>
  );
}
