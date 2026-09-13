import type { Metadata } from "next";
import { AdminList } from "@/client/components/admin-client";
export const metadata: Metadata = { title: "Task packs", robots: { index: false, follow: false } };
export default function TaskPacksPage() {
  return <AdminList />;
}
