import type { Metadata } from "next";
import { DashboardOverview } from "@/client/components/user-dashboard";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export default function Page() {
  return <DashboardOverview />;
}
