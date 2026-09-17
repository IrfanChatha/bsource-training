"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { STORAGE_KEYS, readStored, writeStored } from "@/lib/storage";
import { Brand } from "./brand";

type Theme = "light" | "dark";

const THEME_EVENT = "bsource:themechange";

function readStoredTheme(): Theme | null {
  const stored = readStored(STORAGE_KEYS.theme);
  return stored === "dark" || stored === "light" ? stored : null;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  writeStored(STORAGE_KEYS.theme, theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/* The applied theme lives on <html>, so we read it as an external store rather
   than mirroring it in component state. */
function subscribeToTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function getThemeSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

export function SiteHeader() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    applyTheme(
      readStoredTheme() ??
        (window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"),
    );
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(getThemeSnapshot() === "dark" ? "light" : "dark");
  }, []);

  const isDark = theme === "dark";
  const ThemeIcon = isDark ? Sun : Moon;
  const themeLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <a
          href="#top"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="BSource Training — home"
        >
          <Brand />
        </a>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <ThemeIcon className="size-[18px]" aria-hidden="true" />
          </button>

          <Link
            href="/login"
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            Get Started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none md:hidden"
        >
          {menuOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {menuOpen ? (
        <div
          id="mobile-menu"
          className="border-t border-border bg-background px-5 py-4 md:hidden"
        >
          <div className="grid grid-cols-3 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={themeLabel}
              className="flex h-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ThemeIcon className="size-[18px]" aria-hidden="true" />
            </button>

            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="flex h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-brand"
            >
              Get Started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
