"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { num } from "@/lib/format";

interface IhsgSummary {
  ihsg: number;
  perubahan: number;
  perubahan_pct: number;
}

export function DynamicIslandDock() {
  const [visible, setVisible] = useState(false);
  const [ihsg, setIhsg] = useState<IhsgSummary | null>(null);
  const [watchlistCount, setWatchlistCount] = useState<number>(0);
  const [paperTradesCount, setPaperTradesCount] = useState<number>(0);

  // 1. Scroll listener to reveal dock when scrolling past 250px
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > 260);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 2. Fetch live IHSG summary
  useEffect(() => {
    fetch("/api/ihsg")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ringkasan?: IhsgSummary } | null) => {
        if (j?.ringkasan?.ihsg) {
          setIhsg(j.ringkasan);
        }
      })
      .catch(() => {});
  }, []);

  // 3. Read local state (Watchlist & Paper Trades)
  useEffect(() => {
    const updateCounts = () => {
      try {
        const wl = localStorage.getItem("ihsg-watchlist");
        if (wl) {
          const arr = JSON.parse(wl);
          if (Array.isArray(arr)) setWatchlistCount(arr.length);
        }

        const pt = localStorage.getItem("investara-virtual-trades");
        if (pt) {
          const arr = JSON.parse(pt);
          if (Array.isArray(arr)) {
            const openCount = arr.filter((t: { status: string }) => t.status === "OPEN").length;
            setPaperTradesCount(openCount);
          }
        }
      } catch {}
    };

    updateCounts();
    window.addEventListener("storage", updateCounts);
    const interval = setInterval(updateCounts, 3000);
    return () => {
      window.removeEventListener("storage", updateCounts);
      clearInterval(interval);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCommandPalette = () => {
    window.dispatchEvent(new Event("open-command-palette"));
  };

  const openAiChat = () => {
    window.dispatchEvent(new CustomEvent("open-ai-chat", { detail: { type: "stock" } }));
  };

  const isUp = (ihsg?.perubahan_pct ?? 0) >= 0;

  return (
    <aside
      aria-label="Floating Quick Dock"
      className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] inset-x-0 z-40 flex justify-center px-3 transition-all duration-300 ease-out pointer-events-none ${
        visible
          ? "opacity-100 translate-y-0 scale-100"
          : "invisible opacity-0 translate-y-6 scale-95"
      }`}
    >
      <div className="pointer-events-auto ios-glass-pill crystal-frosted flex items-center gap-1.5 sm:gap-2 rounded-full p-1.5 sm:p-2 shadow-2xl border border-zinc-200/80 dark:border-white/15 min-w-0 max-w-full overflow-hidden">
        {/* IHSG Pulse Pill */}
        <Link
          href="/pasar"
          className="ios-glass-subtle flex items-center gap-1.5 rounded-full min-h-9 px-2 sm:px-3 py-1 text-xs font-bold text-[#191919] hover:bg-white dark:text-white dark:hover:bg-white/10 transition shrink-0 shadow-2xs"
          title="Buka Ringkasan Pasar &amp; Heatmap IHSG"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
                isUp ? "bg-[#22C55E]" : "bg-[#FB6767]"
              } opacity-75`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                isUp ? "bg-[#22C55E]" : "bg-[#FB6767]"
              }`}
            />
          </span>
          <span className="hidden sm:inline">IHSG</span>
          {ihsg ? (
            <span className="tabular-nums flex items-center gap-1">
              <span>{num(ihsg.ihsg, 1)}</span>
              <span className={`text-[10px] ${isUp ? "text-[#22C55E]" : "text-[#FB6767]"}`}>
                {isUp ? "+" : ""}{num(ihsg.perubahan_pct, 2)}%
              </span>
            </span>
          ) : (
            <span className="text-[10px] text-zinc-400">Live</span>
          )}
        </Link>

        {/* Watchlist Quick Pill */}
        {watchlistCount > 0 && (
          <Link
            href="/?grup=watchlist"
            className="hidden md:flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-500/15 border border-amber-500/25 dark:text-amber-300 dark:bg-amber-950/40 hover:scale-102 transition shrink-0"
            title="Lihat saham watchlist terpantau"
          >
            <span>★</span>
            <span>{watchlistCount}</span>
          </Link>
        )}

        {/* Paper Trading Open Positions Pill */}
        {paperTradesCount > 0 && (
          <Link
            href="/simulasi"
            className="hidden sm:flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-teal-800 bg-teal-500/15 border border-teal-500/25 dark:text-teal-300 dark:bg-teal-950/40 hover:scale-102 transition shrink-0"
            title="Buka simulasi posisi paper trading"
          >
            <span>🧪</span>
            <span>{paperTradesCount} Posisi</span>
          </Link>
        )}

        {/* Command Palette Button (⌘K) */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="ios-glass-subtle flex items-center gap-1 rounded-full min-h-9 px-2.5 py-1 text-xs font-bold text-zinc-700 hover:text-black hover:bg-white dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/10 transition shrink-0 shadow-2xs"
          title="Buka pencarian cepat emiten (Ctrl+K / ⌘K)"
        >
          <span>🔍</span>
          <span className="hidden sm:inline">Cari</span>
          <kbd className="hidden lg:inline text-[9px] font-mono opacity-70 bg-zinc-200/50 dark:bg-white/10 px-1 rounded-md">⌘K</kbd>
        </button>

        {/* AI Chatbot Shortcut */}
        <button
          type="button"
          onClick={openAiChat}
          className="flex items-center gap-1 rounded-full bg-[#191919] text-white hover:bg-black dark:bg-white dark:text-[#191919] dark:hover:bg-zinc-200 min-h-9 px-2.5 py-1 text-xs font-black shadow-xs hover:scale-102 active:scale-95 transition shrink-0"
          title="Tanya Analis AI"
        >
          <span>✦</span>
          <span className="hidden sm:inline">AI</span>
        </button>

        {/* Scroll To Top Button */}
        <button
          type="button"
          onClick={scrollToTop}
          className="icon-button size-9 min-h-9 rounded-full border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs font-bold text-xs shrink-0 transition"
          title="Kembali ke atas halaman"
          aria-label="Scroll to top"
        >
          ▲
        </button>
      </div>
    </aside>
  );
}
