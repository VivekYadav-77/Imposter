import type { Metadata } from "next";
import { DashboardHistory } from "@/client/components/user-dashboard";
export const metadata: Metadata = {
  title: "Game history",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <DashboardHistory />;
}
