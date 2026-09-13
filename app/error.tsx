"use client";
import { Button } from "@/client/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="route-state">
      <span className="empty-seal">!</span>
      <h1>That page hit a snag.</h1>
      <p>The issue was contained. You can safely try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
