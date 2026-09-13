import type { Metadata } from "next";
import { RoomClient } from "@/client/components/room-client";
export const metadata: Metadata = { title: "Your room", robots: { index: false, follow: false } };
export default function Room() {
  return <RoomClient />;
}
