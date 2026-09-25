import type { Metadata } from "next";
import { SiteHeader } from "@/client/components/site-shell";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { UserAuthForm } from "@/client/components/user-auth-form";
export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};
export default function Register() {
  return (
    <div className="account-page">
      <SiteHeader minimal backHref="/" backLabel="Back home" />
      <div className="account-theme-toggle">
        <ThemeToggle placement="compact" />
      </div>
      <main id="main-content" className="account-layout account-layout-register">
        <header className="account-intro">
          <p className="eyebrow">Optional account</p>
          <h1>Keep your case files.</h1>
          <p>Guest play stays available. An account adds rejoin, results, and stats.</p>
        </header>
        <UserAuthForm mode="register" />
      </main>
    </div>
  );
}
