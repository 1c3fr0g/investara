"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import type { Status } from "@/lib/types";
import { AuthMenu } from "./AuthButtons";
import { ThemeToggle } from "./ThemeToggle";

function SiteHeaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [open, setOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const isCrypto = pathname?.startsWith("/crypto") ?? false;
  const currentGrup = searchParams?.get("grup");

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const load = () => {
      if (document.hidden) return;
      fetch("/api/alerts/inbox", { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((result: { unreadCount: number } | null) => {
          if (result && !controller.signal.aborted) setAlertCount(result.unreadCount);
        })
        .catch(() => {});
    };
    load();
    const interval = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    window.addEventListener("investara-alert-inbox-updated", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      window.removeEventListener("investara-alert-inbox-updated", load);
    };
  }, [userId]);

  const navItems = isCrypto
    ? [
        { href: "/crypto", label: "Daftar Kripto", active: pathname === "/crypto" },
        { href: "/crypto/heatmap", label: "Peta Panas", active: pathname === "/crypto/heatmap" },
        { href: "/crypto/bandingkan", label: "Bandingkan", active: pathname === "/crypto/bandingkan" },
        { href: "/crypto/portofolio", label: "Portofolio", active: pathname === "/crypto/portofolio" },
      ]
    : [
        {
          href: "/?grup=swing",
          label: "⚡ Radar Swing",
          badge: "1-3%",
          active: pathname === "/" && currentGrup === "swing",
        },
        {
          href: "/",
          label: "📊 Screener",
          active: pathname === "/" && currentGrup !== "swing",
        },
        {
          href: "/simulasi",
          label: "🧪 Simulasi",
          active: pathname === "/simulasi",
        },
        {
          href: "/pasar",
          label: "🌐 Pasar & Makro",
          active: pathname.startsWith("/pasar") || pathname === "/msci" || pathname === "/kalender",
        },
        {
          href: "/portofolio",
          label: "💼 Portofolio",
          active: pathname.startsWith("/portofolio"),
        },
      ];

  return (
    <header className="screen-shell sticky top-2 z-40 sm:top-3.5">
      {/* iOS Crystal Clear Pill Header */}
      <div className="ios-glass-pill crystal-frosted flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-2xl px-2.5 py-2 sm:rounded-full sm:px-5 sm:py-2.5">
        {/* LEFT: Brand + Market Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 whitespace-nowrap">
            <span className="crystal-primary flex size-8 items-center justify-center rounded-[0.7rem] font-black text-sm tracking-tight transition group-hover:scale-105 shrink-0">
              ✦
            </span>
            <span className="leading-tight hidden sm:block shrink-0">
              <span className="block text-sm font-black tracking-tight text-[#191919] dark:text-white whitespace-nowrap">
                Investara
              </span>
              <span className="block text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                IDX &amp; Crypto
              </span>
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px bg-zinc-300/60 dark:bg-white/10 shrink-0" />

          {/* Market Switcher */}
          <div className="hidden sm:flex items-center rounded-full ios-glass-subtle p-0.5 shrink-0">
            <Link
              href="/"
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 transition ${
                !isCrypto
                  ? "bg-white text-[#191919] shadow-xs dark:bg-white/20 dark:text-white"
                  : "text-zinc-500 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              🇮🇩 IDX
            </Link>
            <Link
              href="/crypto"
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 transition ${
                isCrypto
                  ? "bg-white text-[#191919] shadow-xs dark:bg-white/20 dark:text-white"
                  : "text-zinc-500 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              🪙 Crypto
            </Link>
          </div>
        </div>

        {/* CENTER: Segmented Nav */}
        <nav aria-label="Navigasi utama" className="ios-glass-subtle hidden shrink-0 items-center justify-center gap-0.5 rounded-full p-1 xl:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? (item.href.split("?")[0] === pathname ? "page" : "location") : undefined}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                item.active
                  ? "crystal-active"
                  : "text-zinc-600 hover:text-[#191919] dark:text-zinc-300 dark:hover:text-white"
              }`}
            >
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-black whitespace-nowrap shrink-0 ${
                    item.active
                      ? "bg-[#9A83FF] text-white"
                      : "bg-[#9A83FF]/15 text-[#9A83FF] dark:bg-[#9A83FF]/25 dark:text-[#9A83FF]"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* RIGHT: Utilities */}
        <div className="hidden min-w-0 items-center gap-1.5 xl:flex">
          {/* Command Palette ⌘K */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            aria-label="Buka pencarian cepat"
            aria-haspopup="dialog"
            title="Command Palette — Ctrl+K / ⌘K"
            className="ios-glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-white/80 dark:text-zinc-300 dark:hover:bg-white/10 shrink-0 whitespace-nowrap"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.6 10.6z" />
            </svg>
            <span className="whitespace-nowrap">Cari</span>
            <kbd className="rounded-md bg-zinc-200/60 px-1 text-[9px] font-mono text-zinc-600 dark:bg-white/10 dark:text-zinc-300 shrink-0">⌘K</kbd>
          </button>

          {/* Alert Bell */}
          <Link
            href="/alerts"
            title="Kotak masuk alert"
            className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-sm transition shrink-0 ${
              pathname.startsWith("/alerts")
                ? "border-[#FB6767] bg-[#FB6767]/10 text-[#FB6767]"
                : "border-zinc-200/80 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            🔔
            {userId && Boolean(alertCount) && (
              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#FB6767] px-0.5 text-[8px] font-black text-white shrink-0">
                {alertCount > 99 ? "99+" : alertCount}
              </span>
            )}
          </Link>

          {/* Divider */}
          <div className="h-5 w-px bg-zinc-300/60 dark:bg-white/10 mx-0.5 shrink-0" />

          <div className="flex min-w-0 items-center gap-1.5">
            <ThemeToggle />
            <AuthMenu />
          </div>
        </div>

        {/* Mobile Action Controls */}
        <div className="flex min-w-0 items-center gap-1 xl:hidden">
          {/* Mobile Command Palette */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            aria-label="Buka pencarian cepat"
            aria-haspopup="dialog"
            title="Cari (Ctrl+K / ⌘K)"
            className="icon-button rounded-full border border-zinc-200/80 bg-white text-zinc-600 shadow-xs dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.6 10.6z" />
            </svg>
          </button>
          <ThemeToggle />
          <AuthMenu />
          <button
            onClick={() => setOpen(!open)}
            aria-label="Menu navigasi"
            aria-expanded={open}
            aria-controls="mobile-site-navigation"
            className="icon-button rounded-full border border-zinc-200/80 bg-white text-zinc-600 shadow-xs dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {open ? (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <div hidden={!open}>
        <nav id="mobile-site-navigation" aria-label="Navigasi seluler" className="ios-glass-canvas crystal-frosted mt-2 max-h-[70dvh] space-y-2 overflow-y-auto rounded-[1.5rem] p-3 xl:hidden">
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <Link href="/" onClick={() => setOpen(false)} className={`control-button rounded-xl text-xs font-bold ${!isCrypto ? "crystal-active" : "ios-glass-subtle"}`}>Saham IDX</Link>
            <Link href="/crypto" onClick={() => setOpen(false)} className={`control-button rounded-xl text-xs font-bold ${isCrypto ? "crystal-active" : "ios-glass-subtle"}`}>Kripto</Link>
          </div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={item.active ? (item.href.split("?")[0] === pathname ? "page" : "location") : undefined}
              className={`flex min-h-10 items-center justify-between gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
                item.active
                  ? "crystal-active"
                  : "text-zinc-700 hover:bg-white/60 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-[#9A83FF] px-2 py-0.5 text-[9px] font-black text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
          <div className="pt-2 border-t border-zinc-200/60 dark:border-white/10 flex items-center justify-between">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 py-1"
            >
              <span>🔔</span>
              <span>Notifikasi Alert {userId && alertCount > 0 ? `(${alertCount})` : ""}</span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

function SiteHeaderSkeleton() {
  return (
    <header className="screen-shell sticky top-2 z-40 sm:top-3.5">
      <div className="ios-glass-pill crystal-frosted flex items-center justify-between rounded-full px-4 py-2.5 min-h-[56px]">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="crystal-primary flex size-8 items-center justify-center rounded-[0.7rem] font-black text-sm">
              ✦
            </span>
            <span className="block text-sm font-black tracking-tight text-[#191919] dark:text-white">
              Investara
            </span>
          </Link>
        </div>

        <div className="hidden xl:flex items-center gap-2">
          <div className="h-8 w-80 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50" />
        </div>

        <div className="hidden items-center gap-2 text-sm font-medium xl:flex">
          <div className="h-8 w-8 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50" />
          <div className="h-8 w-20 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50" />
        </div>
      </div>
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<SiteHeaderSkeleton />}>
      <SiteHeaderContent />
    </Suspense>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  const hasPadding = /(^|\s)p[xytrbl]?-/.test(className);
  return (
    <section
      className={`ios-glass-canvas min-w-0 max-w-full overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] ${
        hasPadding ? "" : "p-4 sm:p-6"
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100/90 py-3.5 last:border-0 dark:border-zinc-800/80">
      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400" title={hint}>
        {label}
      </span>
      <span className="text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

const badge: Record<Status, { cls: string; icon: string }> = {
  good: { cls: "bg-green-600 text-white dark:bg-green-500", icon: "✓" },
  warn: { cls: "border border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700", icon: "!" },
  bad: { cls: "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 dark:border dark:border-red-800", icon: "✕" },
  na: { cls: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500", icon: "–" },
};

export function StatusBadge({ status }: { status: Status }) {
  const b = badge[status];
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${b.cls}`}>
      {b.icon}
    </span>
  );
}
