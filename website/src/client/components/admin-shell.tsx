"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminFeedbackProvider } from "./admin-feedback";
import { ThemeToggle } from "./theme-toggle";
import { Brand, Icon } from "./ui";

const links = [
  { href: "/admin/task-packs", label: "Dashboard", exact: true },
  { href: "/admin/users", label: "Users", exact: true },
  { href: "/admin/task-packs/new", label: "New map", exact: true },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const dismissOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, [menuOpen]);

  return (
    <AdminFeedbackProvider>
      <div className={`admin-page${isLogin ? " admin-page-login" : ""}`}>
        <header className="admin-header" ref={headerRef}>
          <Link className="admin-brand" href="/" aria-label="Imposter Game home">
            <Brand compact />
            <span>Admin console</span>
          </Link>
          <div className="admin-header-actions">
            {!isLogin && (
              <button
                type="button"
                className="admin-menu-button"
                aria-expanded={menuOpen}
                aria-controls="admin-navigation"
                onClick={() => setMenuOpen((current) => !current)}
              >
                <span>Menu</span>
                <Icon name={menuOpen ? "close" : "chevron"} size={18} />
              </button>
            )}
            {!isLogin && (
              <nav
                id="admin-navigation"
                className={menuOpen ? "is-open" : ""}
                aria-label="Admin navigation"
              >
                {links.map((link) => {
                  const active =
                    pathname === link.href ||
                    (link.href === "/admin/task-packs" &&
                      pathname.startsWith("/admin/task-packs/") &&
                      pathname !== "/admin/task-packs/new");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}
            <ThemeToggle placement="compact" />
          </div>
        </header>
        <main id="main-content" className={`admin-content${isLogin ? " admin-login-content" : ""}`}>
          {children}
        </main>
      </div>
    </AdminFeedbackProvider>
  );
}
