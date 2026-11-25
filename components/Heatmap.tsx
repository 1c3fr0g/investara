"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ListItem } from "@/lib/types";
import { compact, num, rp } from "@/lib/format";

/* ── Color helpers ──────────────────────────────────────────────────── */
function changeColor(pct: number | null): { bg: string; text: string; ring: string } {
  if (pct === null || isNaN(pct)) return { bg: "#71717a", text: "#fff", ring: "#52525b" };
  if (pct >= 4)   return { bg: "#15803d", text: "#fff", ring: "#166534" };
  if (pct >= 2)   return { bg: "#16a34a", text: "#fff", ring: "#15803d" };
  if (pct >= 0.5) return { bg: "#4ade80", text: "#052e16", ring: "#22c55e" };
  if (pct >= -0.5) return { bg: "#a1a1aa", text: "#fff", ring: "#71717a" };
  if (pct >= -2)  return { bg: "#f87171", text: "#fff", ring: "#ef4444" };
  if (pct >= -4)  return { bg: "#ef4444", text: "#fff", ring: "#dc2626" };
  return { bg: "#b91c1c", text: "#fff", ring: "#991b1b" };
}

function changeCls(pct: number | null): string {
  if (pct === null) return "bg-zinc-500 text-white";
  if (pct >= 2)  return "bg-emerald-600 text-white";
  if (pct >= 0.5) return "bg-emerald-400 text-emerald-950 font-bold";
  if (pct >= -0.5) return "bg-zinc-400 text-white";
  if (pct >= -2) return "bg-rose-400 text-white";
  return "bg-rose-600 text-white";
}

/* ── Sector aggregate stats ─────────────────────────────────────────── */
function sectorStats(stocks: ListItem[]) {
  const totalMcap = stocks.reduce((s, x) => s + (x.mcap ?? 0), 0);
  const changes = stocks.flatMap(({ perubahan_pct }) => perubahan_pct === null ? [] : [perubahan_pct]);
  const gaining = changes.filter((change) => change > 0).length;
  const losing = changes.filter((change) => change < 0).length;
  const avgPct = changes.length ? changes.reduce((sum, change) => sum + change, 0) / changes.length : null;
  return { totalMcap, gaining, losing, avgPct };
}

/* ── Bubble size: scale relative to max sector mcap ─────────────────── */
function bubbleSize(mcap: number, maxMcap: number, minPx = 56, maxPx = 112): number {
  if (!maxMcap) return minPx;
  return Math.round(minPx + (maxMcap > 0 ? (mcap / maxMcap) : 0) * (maxPx - minPx));
}

/* ── Stock Bubble ───────────────────────────────────────────────────── */
function StockBubble({ s, maxMcap, hovered, onHover }: {
  s: ListItem; maxMcap: number; hovered: boolean;
  onHover: (v: ListItem | null) => void;
}) {
  const size = bubbleSize(s.mcap ?? 0, maxMcap);
  const col = changeColor(s.perubahan_pct);
  const up = (s.perubahan_pct ?? 0) >= 0;
  const pctStr = s.perubahan_pct === null ? "-" : `${up ? "+" : ""}${num(s.perubahan_pct, 1)}%`;

  return (
    <Link
      href={`/saham/${s.kode}`}
      onMouseEnter={() => onHover(s)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(s)}
      onBlur={() => onHover(null)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: col.bg,
        color: col.text,
        outline: hovered ? `3px solid ${col.ring}` : undefined,
        outlineOffset: "2px",
        transform: hovered ? "scale(1.14)" : "scale(1)",
        transition: "transform 0.15s ease, outline 0.1s ease",
        zIndex: hovered ? 10 : 1,
      }}
      className="relative flex flex-col items-center justify-center rounded-full shadow-md select-none"
    >
      <span className="text-center font-extrabold leading-tight tracking-tight" style={{ fontSize: `${Math.max(9, Math.round(size * 0.14))}px` }}>
        {s.kode}
      </span>
      <span className="font-semibold leading-tight pt-0.5" style={{ fontSize: `${Math.max(8, Math.round(size * 0.12))}px` }}>
        {pctStr}
      </span>
      {size >= 80 && (
        <span className="opacity-85 leading-tight pt-0.5" style={{ fontSize: `${Math.max(8, Math.round(size * 0.1))}px` }}>
          {rp(s.harga)}
        </span>
      )}
    </Link>
  );
}

/* ── Sector Bubble Card ──────────────────────────────────────────────── */
function SectorCard({ sektor, stocks, hovered, onHover }: {
  sektor: string;
  stocks: ListItem[];
  hovered: ListItem | null;
  onHover: (v: ListItem | null) => void;
}) {
  const { totalMcap, gaining, losing, avgPct } = sectorStats(stocks);
  const maxMcap = Math.max(...stocks.map((s) => s.mcap ?? 0));
  const isUp = (avgPct ?? 0) >= 0;

  return (
    <div className="ios-glass-canvas overflow-hidden rounded-2xl sm:rounded-3xl">
      {/* Sector header */}
      <div className={`flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 ${isUp ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-rose-50/50 dark:bg-rose-950/20"}`}>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">{sektor}</h3>
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{compact(totalMcap)}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">▲ {gaining}</span>
            <span className="text-rose-500 dark:text-rose-400 font-semibold">▼ {losing}</span>
          </div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-extrabold shadow-xs ${changeCls(avgPct)}`}>
          {avgPct === null ? "-" : `${isUp ? "+" : ""}${num(avgPct, 1)}%`}
        </div>
      </div>

      {/* Bubbles area */}
      <div className="flex flex-wrap items-center justify-center gap-3 p-5 min-h-[180px]">
        {stocks.map((s) => (
          <StockBubble
            key={s.kode}
            s={s}
            maxMcap={maxMcap}
            hovered={hovered?.kode === s.kode}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main Heatmap component ─────────────────────────────────────────── */
const SEKTORS = [
  "Semua Sektor",
  "Keuangan",
  "Energi",
  "Barang Baku",
  "Perindustrian",
  "Barang Konsumen Primer",
  "Barang Konsumen Non-Primer",
  "Kesehatan",
  "Properti & Real Estat",
  "Teknologi",
  "Infrastruktur",
  "Transportasi & Logistik",
];

export function Heatmap() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedSektor, setSelectedSektor] = useState("Semua Sektor");
  const [limit, setLimit] = useState<number>(100);
  const [hovered, setHovered] = useState<ListItem | null>(null);
  const [showAll, setShowAll] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/saham?sort=mcap&dir=desc&size=1000", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Gagal memuat peta panas.");
        return r.json();
      })
      .then(({ items }: { items: ListItem[] }) => { if (!controller.signal.aborted) setItems(items); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.mcap && i.mcap > 0 && i.harga);
    if (selectedSektor !== "Semua Sektor") {
      list = list.filter((i) => i.sektor?.toLowerCase() === selectedSektor.toLowerCase());
    }
    return list.slice(0, limit);
  }, [items, selectedSektor, limit]);

  // Group by sector, sorted by avg change (biggest movers on top)
  const groups = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const item of filtered) {
      const s = item.sektor || "Lainnya";
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(item);
    }
    return [...map.entries()].sort((a, b) => {
      const avgA = sectorStats(a[1]).avgPct ?? 0;
      const avgB = sectorStats(b[1]).avgPct ?? 0;
      return Math.abs(avgB) - Math.abs(avgA); // most volatile sectors first
    });
  }, [filtered]);

  // Market summary
  const allGaining = filtered.filter((x) => (x.perubahan_pct ?? 0) > 0).length;
  const allLosing  = filtered.filter((x) => (x.perubahan_pct ?? 0) < 0).length;
  const allFlat = filtered.filter((x) => x.perubahan_pct === 0).length;
  const unavailable = filtered.length - allGaining - allLosing - allFlat;

  const displayGroups = showAll ? groups : groups.slice(0, 6);

  return (
    <main className="screen-shell space-y-8 screen-section">
      {/* Header */}
      <div className="crystal-intro flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="crystal-title">
              Peta Panas Pasar (Market Heatmap)
            </h1>
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Data IDX
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ukuran bubble sebanding dengan Market Cap · Warna merefleksikan perubahan harga hari ini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter sektor"
            value={selectedSektor}
            onChange={(e) => setSelectedSektor(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-800 outline-none focus:border-green-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {SEKTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="flex rounded-xl border border-zinc-200 bg-white p-1 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            {[50, 100, 200, 500].map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  limit === n ? "bg-green-600 text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
          {unavailable > 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400">{unavailable} perubahan harga belum tersedia</p>}
        </div>
      </div>

      {/* Market summary bar */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-[#1a1d27]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{allGaining} Naik</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-full bg-zinc-400" />
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">{allFlat} Stagnan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-full bg-rose-500" />
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{allLosing} Turun</span>
            </div>
          </div>

          {/* Color scale legend */}
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            {[
              { label: "< −4%", bg: "#b91c1c" },
              { label: "−2%", bg: "#ef4444" },
              { label: "0%", bg: "#a1a1aa" },
              { label: "+2%", bg: "#16a34a" },
              { label: "> +4%", bg: "#15803d" },
            ].map((c) => (
              <span key={c.label} className="flex items-center font-semibold text-white">
                <span className="rounded-lg px-2 py-0.5 text-[11px]" style={{ backgroundColor: c.bg }}>{c.label}</span>
              </span>
            ))}
          </div>

          {/* Hovered stock info */}
          {hovered && (
            <div className="w-full sm:w-auto rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/80">
              <span className="font-extrabold text-zinc-900 dark:text-zinc-100">{hovered.kode}</span>
              <span className="ml-2.5 font-semibold text-zinc-600 dark:text-zinc-400">{rp(hovered.harga)}</span>
              <span className={`ml-2.5 font-bold ${(hovered.perubahan_pct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {hovered.perubahan_pct === null ? "Perubahan belum tersedia" : `${hovered.perubahan_pct >= 0 ? "+" : ""}${num(hovered.perubahan_pct, 2)}%`}
              </span>
              <span className="ml-2.5 text-zinc-500 dark:text-zinc-400">MCap: {compact(hovered.mcap)}</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex h-80 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#1a1d27]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-100 border-t-green-500 dark:border-zinc-800 dark:border-t-green-400" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Memuat visualisasi peta panas pasar...</p>
          </div>
        </div>
      ) : error ? (
        <div className="ios-glass-canvas space-y-3 rounded-2xl p-6 text-center text-sm">
          <p role="alert">Peta panas gagal dimuat.</p>
          <button type="button" className="control-button ios-glass-pill rounded-xl font-semibold" onClick={() => {
            setError(false);
            setLoading(true);
            setRetry((value) => value + 1);
          }}>Coba lagi</button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-[#1a1d27] dark:text-zinc-400">
          Tidak ada saham yang sesuai dengan filter sektor terpilih.
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {displayGroups.map(([sektor, stockList]) => (
              <SectorCard
                key={sektor}
                sektor={sektor}
                stocks={stockList}
                hovered={hovered}
                onHover={setHovered}
              />
            ))}
          </div>

          {groups.length > 6 && (
            <div className="text-center pt-2">
              <button
                onClick={() => setShowAll(!showAll)}
                className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-700 shadow-xs transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {showAll ? "Tampilkan lebih sedikit ↑" : `Tampilkan semua ${groups.length} sektor ↓`}
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed pt-2">
        Data bersumber dari Yahoo Finance (tertunda 10–15 menit). Bukan rekomendasi investasi.
      </p>
    </main>
  );
}
