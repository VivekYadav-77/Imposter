import type { Metadata } from "next";
import { AdminUsers } from "@/client/components/admin-client";

export const metadata: Metadata = {
  title: "Platform users",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return <AdminUsers />;
}
