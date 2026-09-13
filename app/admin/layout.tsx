import Link from "next/link";
import { Brand } from "@/client/components/ui";
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link href="/">
          <Brand compact />
        </Link>
        <span>ADMINISTRATION</span>
      </header>
      <main id="main-content" className="admin-content">
        {children}
      </main>
    </div>
  );
}
