import { SignalSceneArt } from "@/client/components/signal-visuals";

export default function Loading() {
  return (
    <main className="route-state" aria-busy="true">
      <div className="route-state-art">
        <SignalSceneArt scene="lobby" compact />
      </div>
      <div className="route-loader" />
      <h1>Opening the room</h1>
      <p>Securing your seat and syncing the latest signal…</p>
    </main>
  );
}
