import { notFound } from "next/navigation";
import { Showcase } from "@/client/components/showcase";

export default function ShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Showcase />;
}
