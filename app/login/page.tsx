import type { Metadata } from "next";
import { SiteHeader } from "@/client/components/site-shell";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { GoogleSignInCard } from "@/client/components/user-auth-form";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string | string[] }>;
}) {
  const value = (await searchParams).authError;
  const authError = Array.isArray(value) ? value[0] : value;
  return (
    <div className="account-page">
      <SiteHeader minimal backHref="/" backLabel="Back home" />
      <div className="account-theme-toggle">
        <ThemeToggle placement="compact" />
      </div>
      <main id="main-content" className="account-layout account-layout-login">
        <header className="account-intro">
          <p className="eyebrow">Player account</p>
          <h1>Return to your cases.</h1>
          <p>Rejoin rooms and keep your game history across devices.</p>
        </header>
        <GoogleSignInCard authError={authError} />
      </main>
    </div>
  );
}
