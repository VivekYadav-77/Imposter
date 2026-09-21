import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeToggle } from "@/client/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Imposter Game — Trust no one. Prove everything.",
    template: "%s · Imposter Game",
  },
  description:
    "A live social deduction game for your next hangout. No download, no accounts — just a room code.",
  openGraph: {
    title: "Imposter Game",
    description: "Everyone’s watching. Someone’s lying.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/theme-init.js" nonce={nonce} suppressHydrationWarning />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
