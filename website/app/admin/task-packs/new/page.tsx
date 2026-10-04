import type { Metadata } from "next";
import { AdminEditor } from "@/client/components/admin-client";
export const metadata: Metadata = {
  title: "New map",
  robots: { index: false, follow: false },
};
export default function NewTaskPackPage() {
  return <AdminEditor />;
}
