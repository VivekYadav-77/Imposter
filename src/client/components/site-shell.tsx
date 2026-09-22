"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand, Icon } from "./ui";

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link href="/" aria-label="Imposter Game home">
        <Brand />
      </Link>
      {!minimal && (
        <>
          <button
            className="menu-button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="site-nav"
          >
            <span>Menu</span>
            <Icon name={open ? "close" : "chevron"} size={18} />
          </button>
          <nav id="site-nav" className={open ? "nav-open" : ""} aria-label="Main navigation">
            <Link href="/how-to-play">How to play</Link>
            <Link href="/privacy-and-photos">Privacy & photos</Link>
            <Link className="button button-primary" href="/play">
              Start a room <Icon name="arrow" size={17} />
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Brand compact />
      <p>
        Trust no one. <span>Prove everything.</span>
      </p>
      <nav aria-label="Footer">
        <Link href="/how-to-play">How to play</Link>
        <Link href="/privacy-and-photos">Privacy & photos</Link>
        <Link href="/admin/login">Admin</Link>
      </nav>
      <small>18+ · Built for private rooms.</small>
    </footer>
  );
}
