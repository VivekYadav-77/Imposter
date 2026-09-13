import type { Metadata } from "next";
import { AdminEditor } from "@/client/components/admin-client";
export const metadata: Metadata = {
  title: "Edit task pack",
  robots: { index: false, follow: false },
};
export default async function EditTaskPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditor packId={id} />;
}
