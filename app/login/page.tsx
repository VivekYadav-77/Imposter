import type { Metadata } from "next";
import { SiteHeader } from "@/client/components/site-shell";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { UserAuthForm } from "@/client/components/user-auth-form";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default function Login() {
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
        <UserAuthForm mode="login" />
      </main>
    </div>
  );
}
