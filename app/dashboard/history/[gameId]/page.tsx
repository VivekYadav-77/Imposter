import type { Metadata } from "next";
import { DashboardGame } from "@/client/components/user-dashboard";
export const metadata: Metadata = { title: "Game result", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <DashboardGame gameId={gameId} />;
}
