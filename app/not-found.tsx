import Link from "next/link";
export default function NotFound() {
  return (
    <main className="route-state">
      <span className="empty-seal">404</span>
      <h1>Case file not found.</h1>
      <p>This page may have moved or never existed.</p>
      <Link className="button button-primary" href="/">
        Return home
      </Link>
    </main>
  );
}
