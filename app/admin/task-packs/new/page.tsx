import type { Metadata } from "next";
import { AdminEditor } from "@/client/components/admin-client";
export const metadata: Metadata = {
  title: "New task pack",
  robots: { index: false, follow: false },
};
export default function NewTaskPackPage() {
  return <AdminEditor />;
}
