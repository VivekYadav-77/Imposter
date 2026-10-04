"use client";
import { Button, Icon } from "@/client/components/ui";
import { SignalSceneArt } from "@/client/components/signal-visuals";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="route-state">
      <div className="route-state-art">
        <SignalSceneArt scene="meeting" compact />
      </div>
      <span className="empty-seal">
        <Icon name="warning" />
      </span>
      <h1>That page hit a snag.</h1>
      <p>The issue was contained. You can safely try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
