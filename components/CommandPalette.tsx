"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rp, num } from "@/lib/format";

interface SearchResult {
  kode: string;
  nama: string;
  harga: number | null;
  perubahan_pct: number | null;
  sektor?: string | null;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  href?: string;
  action?: () => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "screener", label: "Screener Saham IDX", icon: "📊", href: "/", shortcut: "S" },
  { id: "investasi", label: "Seleksi Saham Investasi", icon: "🔎", href: "/seleksi-investasi" },
  { id: "swing", label: "Radar Swing 1–3%", icon: "⚡", href: "/?grup=swing", shortcut: "W" },
  { id: "pasar", label: "Pasar & Makro", icon: "🌐", href: "/pasar", shortcut: "P" },
  { id: "portofolio", label: "Portofolio Saya", icon: "💼", href: "/portofolio" },
  { id: "simulasi", label: "Simulasi Paper Trade", icon: "🧪", href: "/simulasi" },
  { id: "alerts", label: "Notifikasi Alert Harga", icon: "🔔", href: "/alerts" },
  { id: "crypto", label: "Daftar Kripto", icon: "🪙", href: "/crypto" },
  { id: "ai", label: "Tanya Analis AI", icon: "🤖", action: () => window.dispatchEvent(new CustomEvent("open-ai-chat", { detail: { type: "general" } })) },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ term: string; items: SearchResult[]; failed: boolean } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const term = query.trim();
  const results = term && result?.term === term ? result.items : [];
  const loading = Boolean(term && result?.term !== term);
  const failed = Boolean(result?.term === term && result.failed);

  const dismiss = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus({ preventScroll: true });
    openerRef.current = null;
  }, []);

  /* ── Open / close via keyboard ─────────────────────────── */
  useEffect(() => {
    function onOpen() {
      if (open) return;
      if (document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
      setQuery("");
      setResult(null);
      setSelectedIdx(0);
      setOpen(true);
    }
    function onKey(e: KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) dismiss();
        else onOpen();
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, [dismiss, open]);

  /* ── Auto-focus input when opens ───────────────────────── */
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  /* ── Debounced search ───────────────────────────────────── */
  useEffect(() => {
    if (!open || !term) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      let items: SearchResult[] = [];
      let failed = false;
      try {
        const response = await fetch(`/api/saham?q=${encodeURIComponent(term)}&size=8`, { signal: controller.signal });
        if (!response.ok) throw new Error("Pencarian gagal");
        items = (await response.json()).items ?? [];
      } catch {
        failed = true;
      }
      if (!controller.signal.aborted) setResult({ term, items, failed });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, term]);

  /* ── Visible items (actions filtered + stock results) ─── */
  const filteredActions = QUICK_ACTIONS.filter(
    (a) =>
      !query ||
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      (a.shortcut && a.shortcut.toLowerCase() === query.toLowerCase())
  );
  const totalItems = filteredActions.length + results.length;
  const activeIndex = totalItems ? Math.min(selectedIdx, totalItems - 1) : -1;

  /* ── Navigate via keyboard arrows ──────────────────────── */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229 || activeIndex < 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const index = Math.min(totalItems - 1, Math.max(0, activeIndex + (e.key === "ArrowDown" ? 1 : -1)));
      setSelectedIdx(index);
      document.getElementById("command-option-" + index)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex < filteredActions.length) {
        activateAction(filteredActions[activeIndex]);
      } else {
        const stock = results[activeIndex - filteredActions.length];
        if (stock) navigate(`/saham/${stock.kode}`);
      }
    }
  }

  function activateAction(a: QuickAction) {
    openerRef.current = null;
    setOpen(false);
    if (a.href) router.push(a.href);
    else if (a.action) a.action();
  }

  function navigate(href: string) {
    openerRef.current = null;
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-3 pb-3 pt-[min(12dvh,5rem)] sm:px-4"
      onClick={dismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#191919]/40 backdrop-blur-sm dark:bg-black/60" />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian cepat Investara"
        className="ios-glass-pill crystal-frosted viewport-dialog relative min-w-0 w-full max-w-xl overflow-x-hidden rounded-[1.75rem] max-h-[calc(100dvh-min(12dvh,5rem)-0.75rem)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          e.preventDefault();
          if (document.activeElement === inputRef.current) closeRef.current?.focus();
          else inputRef.current?.focus();
        }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-zinc-200/70 px-5 py-4 dark:border-white/10">
          <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.6 10.6z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Cari saham, halaman, atau aksi"
            aria-expanded="true"
            aria-controls="command-results"
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? "command-option-" + activeIndex : undefined}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={onKeyDown}
            placeholder="Cari saham, halaman, atau aksi…"
            className="min-w-0 flex-1 rounded-sm bg-transparent text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--glass-focus)] dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {loading && (
            <div aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border-2 border-zinc-200 border-t-zinc-500 motion-safe:animate-spin dark:border-zinc-700 dark:border-t-zinc-400" />
          )}
          <button ref={closeRef} type="button" onClick={dismiss} aria-label="Tutup pencarian"
            className="icon-button ios-glass-subtle min-h-11 w-11 cursor-pointer rounded-lg text-base font-bold text-zinc-600 dark:text-zinc-300">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Results */}
        <p role="status" className="sr-only">
          {loading ? "Mencari saham…" : failed ? "Pencarian saham gagal." : `${totalItems} pilihan tersedia.`}
        </p>
        <div id="command-results" role="listbox" aria-label="Hasil pencarian" className="max-h-[400px] overflow-y-auto overscroll-contain py-2">
          {/* Quick Actions */}
          {filteredActions.length > 0 && (
            <div role="group" aria-label="Aksi cepat">
              {query.trim() === "" && (
                <div aria-hidden="true" className="px-5 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  Aksi Cepat
                </div>
              )}
              {filteredActions.map((a, i) => (
                <button
                  key={a.id}
                  id={"command-option-" + i}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={activeIndex === i}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => activateAction(a)}
                  className={`flex w-full cursor-pointer items-center gap-3.5 px-5 py-2.5 text-left transition ${
                    activeIndex === i
                      ? "bg-zinc-100/80 dark:bg-zinc-800/60"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  }`}
                >
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-base shadow-xs dark:border-zinc-700 dark:bg-zinc-800">
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {a.label}
                  </span>
                  {a.shortcut && (
                    <kbd aria-hidden="true" className="shrink-0 rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                      {a.shortcut}
                    </kbd>
                  )}
                  <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Stock Results */}
          {results.length > 0 && (
            <div role="group" aria-label="Saham IDX">
              <div aria-hidden="true" className="px-5 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Saham IDX
              </div>
              {results.map((s, i) => {
                const idx = filteredActions.length + i;
                const up = (s.perubahan_pct ?? 0) >= 0;
                return (
                  <button
                    key={s.kode}
                    id={"command-option-" + idx}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={activeIndex === idx}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => navigate(`/saham/${s.kode}`)}
                    className={`flex w-full cursor-pointer items-center gap-3.5 px-5 py-2.5 text-left transition ${
                      activeIndex === idx
                        ? "bg-zinc-100/80 dark:bg-zinc-800/60"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                    }`}
                  >
                    {/* Logo placeholder */}
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 text-[11px] font-black text-zinc-600 shadow-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      {s.kode.slice(0, 2)}
                    </span>
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 shrink-0">{s.kode}</span>
                      <span className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">{s.nama}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{rp(s.harga)}</div>
                      <div className={`text-xs font-bold tabular-nums ${up ? "text-[#22C55E]" : "text-[#FB6767]"}`}>
                        {s.perubahan_pct === null ? "-" : `${up ? "+" : ""}${num(s.perubahan_pct, 2)}%`}
                      </div>
                    </div>
                    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}

        </div>
        {term && !loading && (failed || totalItems === 0) && (
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center wrap-anywhere">
              <span aria-hidden="true" className="text-2xl">🔍</span>
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {failed ? "Pencarian saham gagal dimuat." : <>Tidak ditemukan untuk &ldquo;{query}&rdquo;</>}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {failed ? "Ubah kata kunci untuk mencoba lagi." : "Coba kode saham (mis. BBCA, TLKM, GOTO)"}
              </p>
            </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-2.5 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 text-[10px] text-zinc-400 dark:text-zinc-500">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 font-mono dark:border-zinc-700 dark:bg-zinc-800">↑↓</kbd>
              Navigasi
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 font-mono dark:border-zinc-700 dark:bg-zinc-800">↵</kbd>
              Buka
            </span>
          </div>
          <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
            Investara Command
          </span>
        </div>
      </div>
    </div>
  );
}
