"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { SavedFilter } from "@/lib/db";

import { FILTER_DEFS, FILTER_PARAMS, SAVED_QUERY_PARAMS, savedScreenerQuery } from "@/lib/screener";
export { FILTER_PARAMS } from "@/lib/screener";

export type StrategyPreset = {
  id: string;
  badge: string;
  label: string;
  desc: string;
  icon: string;
  v: Record<string, string>;
};

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: "magic-formula",
    badge: "Magic Formula",
    label: "Magic Formula (Greenblatt)",
    desc: "Kombinasi ROE tinggi (≥ 18%) dan valuasi murah (PER ≤ 10, PBV ≤ 2.5)",
    icon: "💎",
    v: { min_roe: "18", min_per: "1", max_per: "10", max_pbv: "2.5" },
  },
  {
    id: "dividend-aristocrats",
    badge: "Dividen Aristokrat",
    label: "Dividen Aristokrat",
    desc: "Yield dividen tinggi (≥ 6%), payout aman (30-85%), DER aman (≤ 120%)",
    icon: "👑",
    v: { min_yield_pct: "6", min_payout: "30", max_payout: "85", max_der: "120" },
  },
  {
    id: "graham-defensive",
    badge: "Graham Defensive",
    label: "Graham Defensive Investor",
    desc: "Margin of safety Benjamin Graham: PBV ≤ 1.2, PER ≤ 12, DER ≤ 80%, ROE ≥ 8%",
    icon: "🛡️",
    v: { max_pbv: "1.2", min_per: "1", max_per: "12", max_der: "80", min_roe: "8" },
  },
  {
    id: "breakout-growth",
    badge: "Breakout Growth",
    label: "Breakout Growth Champion",
    desc: "Pertumbuhan laba (≥ 15%) & omzet (≥ 10%) pesat dengan margin laba ≥ 12%",
    icon: "🚀",
    v: { min_laba_growth: "15", min_pendapatan_growth: "10", min_margin: "12", min_roe: "14" },
  },
  {
    id: "bluechip-undervalued",
    badge: "Blue Chip Undervalued",
    label: "Blue Chip Undervalued",
    desc: "Market cap jumbo (≥ Rp 20 T), PER ≤ 14, ROE solid (≥ 12%)",
    icon: "🏛️",
    v: { min_mcap: "20000", max_per: "14", min_roe: "12" },
  },
  {
    id: "steady-compounder",
    badge: "Aman & Teruji",
    label: "Aman & Stabil (Compounder)",
    desc: "Minim utang (DER ≤ 75%), margin tebal (≥ 10%), dan ROE konsisten (≥ 12%)",
    icon: "📈",
    v: { max_der: "75", min_margin: "10", min_roe: "12" },
  },
  {
    id: "msci-giants",
    badge: "MSCI Giants",
    label: "MSCI Global Large Cap (Foreign Favorites)",
    desc: "Saham pilar indeks MSCI global: kapitalisasi pasar jumbo (≥ Rp 25 T) dengan profitabilitas solid (ROE ≥ 12%)",
    icon: "🌍",
    v: { min_mcap: "25000", min_roe: "12" },
  },
  {
    id: "fast-swing-1-3",
    badge: "⚡ Fast Swing 1-3%",
    label: "⚡ Fast Swing & Scalping (Target Profit 1-3%)",
    desc: "Saham likuid (Mcap ≥ Rp 3 T, ROE ≥ 8%, DER aman) dengan volatilitas sehat untuk strategi 'Beli Sore Jual Pagi' (BSJP) atau swing cepat 1-3 hari",
    icon: "⚡",
    v: { min_mcap: "3000", min_roe: "8", max_der: "150" },
  },
];

export function FilterPanel({
  values,
  query,
  onApply,
  onOpenSaved,
}: {
  values: Record<string, string>;
  query: string;
  onOpenSaved: (next: Record<string, string | null>) => void;
  onApply: (next: Record<string, string | null>) => void;
}) {
  const { status, data: session } = useSession();
  const [draft, setDraft] = useState<Record<string, string>>(values);
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [nama, setNama] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState(() => Object.keys(values).length > 0);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    fetch("/api/filter", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gagal memuat filter tersimpan.");
        const { items }: { items: SavedFilter[] } = await response.json();
        if (!controller.signal.aborted) setSaved(items);
      })
      .catch(() => { if (!controller.signal.aborted) setMsg("Gagal memuat filter tersimpan."); });
    return () => controller.abort();
  }, [status, session?.user?.id]);

  const aktif = FILTER_PARAMS.filter((k) => values[k]).length;

  function apply(v: Record<string, string>) {
    const next: Record<string, string | null> = {};
    for (const k of FILTER_PARAMS) next[k] = v[k]?.trim() ? v[k].trim() : null;
    onApply({ ...next, page: null });
  }

  function reset() {
    setDraft({});
    apply({});
  }

  async function mutate(method: "POST" | "PATCH" | "DELETE", data: object | null, id = "") {
    if (pending) return;
    setPending(id || "save");
    setMsg("");
    try {
      const response = await fetch("/api/filter" + (method === "DELETE" ? "?id=" + encodeURIComponent(id) : ""), {
        method,
        ...(data && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Gagal menyimpan perubahan.");
      if (method === "POST") {
        setSaved((items) => [...items, result.item]);
        setNama("");
        setMsg("Filter disimpan.");
      } else if (method === "PATCH") {
        setSaved((items) => items.map((item) => item.id === id ? result.item : item));
        setMsg(result.item.monitor ? "Alert aktif. Pemindaian pertama mencatat hasil awal." : "Alert filter dijeda.");
      } else {
        setSaved((items) => items.filter((item) => item.id !== id));
        setMsg("Filter dihapus.");
      }
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Gagal menyimpan perubahan.");
    } finally {
      setPending(null);
    }
  }

  function simpan(event: React.FormEvent) {
    event.preventDefault();
    if (!nama.trim()) return setMsg("Isi nama filter.");
    const params = new URLSearchParams(query);
    for (const key of FILTER_PARAMS) {
      const value = draft[key]?.trim();
      if (value) params.set(key, value);
      else params.delete(key);
    }
    try {
      void mutate("POST", { nama, query: savedScreenerQuery(params.toString()).toString() });
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Filter tidak valid.");
    }
  }

  function pakai(savedFilter: SavedFilter) {
    try {
      const params = savedScreenerQuery(savedFilter.query);
      setDraft(Object.fromEntries(FILTER_PARAMS.flatMap((key) => params.has(key) ? [[key, params.get(key)!]] : [])));
      onOpenSaved({ ...Object.fromEntries(SAVED_QUERY_PARAMS.map((key) => [key, params.get(key)])), page: null });
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Filter tidak valid.");
    }
  }

  const inputCls =
    "ios-glass-subtle w-full rounded-2xl border border-zinc-200/80 bg-white/80 px-3 py-2 text-xs font-semibold outline-none transition placeholder:text-zinc-400 focus:ring-2 focus:ring-[#9A83FF]/40 text-[#191919] dark:text-white dark:bg-white/5";

  return (
    <div className="ios-glass-canvas relative rounded-[32px] border border-zinc-200/80 shadow-2xl dark:border-white/10 overflow-hidden transition-all">
      {/* Toggle header bar (valid semantic markup: div container with sibling buttons) */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 text-left transition hover:opacity-80 cursor-pointer"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Filter Fundamental Lanjutan
          </span>
          {aktif > 0 && (
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
              {aktif} aktif
            </span>
          )}
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {saved.length > 0 && (
            <div className="hidden sm:flex gap-1.5 mr-1">
              {saved.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pakai(s)}
                  className="rounded-full border border-zinc-200/80 px-2.5 py-0.5 text-[10px] font-medium text-zinc-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  {s.nama}
                </button>
              ))}
            </div>
          )}

          {aktif > 0 && (
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-zinc-200/80 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500 transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:hover:text-red-400"
            >
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Tutup panel filter" : "Buka panel filter"}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {open ? "Tutup ▲" : "Buka ▼"}
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-100 px-5 pb-6 pt-4 dark:border-zinc-800 space-y-4">
          {/* Preset chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="self-center text-xs font-semibold text-zinc-500 dark:text-zinc-400 mr-1">Preset Strategi:</span>
            {STRATEGY_PRESETS.map((p) => (
              <button
                key={p.id}
                title={p.desc}
                onClick={() => {
                  setDraft(p.v);
                  apply(p.v);
                }}
                className="flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:text-emerald-400"
              >
                <span>{p.icon}</span>
                <span>{p.badge}</span>
              </button>
            ))}
          </div>

          {/* Filter inputs grid */}
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5 pt-1">
            {FILTER_DEFS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{f.label}</label>
                <div className="flex items-center gap-1.5">
                  <input
                    inputMode="decimal"
                    placeholder="Min"
                    className={inputCls}
                    value={draft[`min_${f.key}`] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [`min_${f.key}`]: e.target.value }))}
                  />
                  <span className="text-zinc-300 dark:text-zinc-700">–</span>
                  <input
                    inputMode="decimal"
                    placeholder="Maks"
                    className={inputCls}
                    value={draft[`max_${f.key}`] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [`max_${f.key}`]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-200/70 dark:border-white/10">
            <button
              onClick={() => apply(draft)}
              className="control-button crystal-primary rounded-full py-2 text-xs font-black shadow-md hover:scale-[1.01] active:scale-95 transition"
            >
              Terapkan Filter
            </button>
            <button
              onClick={reset}
              className="control-button rounded-full border border-zinc-200/80 bg-white py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 transition"
            >
              Reset
            </button>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-1">
              Saham tanpa data untuk kriteria terpilih akan disaring otomatis.
            </span>
          </div>

          <section className="mt-4 space-y-3 border-t border-zinc-200/70 pt-4 dark:border-white/10" aria-label="Filter tersimpan">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Filter tersimpan</h3>
              <Link href="/alerts" className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Lihat notifikasi</Link>
            </div>
            {status === "authenticated" ? (
              <>
                <form onSubmit={simpan} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1 basis-44 text-xs font-semibold">
                    Nama filter
                    <input value={nama} maxLength={60} onChange={(event) => setNama(event.target.value)} placeholder="Contoh: Dividen tinggi" className={inputCls + " mt-1 min-h-10"} />
                  </label>
                  <button type="submit" disabled={pending !== null} className="ios-glass-pill control-button rounded-xl text-xs font-semibold disabled:opacity-50">
                    {pending === "save" ? "Menyimpan…" : "Simpan filter"}
                  </button>
                </form>
                {saved.length === 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400">Simpan pencarian atau kriteria yang ingin dipakai lagi.</p>}
                {saved.map((item) => (
                  <div key={item.id} className="ios-glass-card flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
                    <div className="min-w-0 flex-1 basis-32 wrap-anywhere">
                      <p className="text-sm font-semibold">{item.nama}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {item.monitor ? item.checkedAt ? "Alert aktif" : "Menunggu pemindaian awal" : "Alert dijeda"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => pakai(item)} className="ios-glass-pill control-button rounded-xl text-xs font-semibold">Pakai</button>
                      <button type="button" disabled={pending !== null} onClick={() => void mutate("PATCH", { id: item.id, monitor: !item.monitor }, item.id)} className="ios-glass-pill control-button rounded-xl text-xs font-semibold disabled:opacity-50">
                        {item.monitor ? "Jeda alert" : "Aktifkan alert"}
                      </button>
                      <button type="button" disabled={pending !== null} onClick={() => void mutate("DELETE", null, item.id)} aria-label={"Hapus filter " + item.nama} className="control-button rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/50">Hapus</button>
                    </div>
                  </div>
                ))}
              </>
            ) : status !== "loading" && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400"><Link href="/portofolio" className="font-semibold underline">Masuk</Link> untuk menyimpan filter dan mengaktifkan alert.</p>
            )}
            {msg && <p role="status" className="text-xs font-semibold">{msg}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
