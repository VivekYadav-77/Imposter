import type { Metadata } from "next";
import { DashboardSettings } from "@/client/components/user-dashboard";
export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <DashboardSettings />;
}
