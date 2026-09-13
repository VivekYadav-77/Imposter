import type { Metadata } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
