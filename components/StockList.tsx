"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ListItem, ListResponse } from "@/lib/types";
import { compact, num, pct, rp, signedPct } from "@/lib/format";
import { GROUPS, MSCI_STANDARD, MSCI_SMALLCAP } from "@/lib/groups";
import { Card } from "./ui";
import { FILTER_PARAMS, FilterPanel, STRATEGY_PRESETS } from "./FilterPanel";
import { StarButton, useWatchlist } from "./Watchlist";
import { StockLogo } from "./StockLogo";
import { PriceFlash, LiveBadge } from "./PriceFlash";
import { usePaperTrading } from "@/lib/paperTrading";
import { NewsSentimentRecommendations } from "./NewsSentimentRecommendations";
import { useHomeMarket } from "./HomeMarketProvider";
import type { MacroEvent } from "@/lib/macro";
import { projectSwingPrices } from "@/lib/bestBuy";

const MSCI_STANDARD_SET = new Set(MSCI_STANDARD);
const MSCI_SMALLCAP_SET = new Set(MSCI_SMALLCAP);

const COLS = [
  { key: "star", label: "", left: true, nosort: true, w: "w-12" },
  { key: "kode", label: "Kode", left: true, nosort: true, w: "w-36" },
  { key: "nama", label: "Nama Perusahaan", left: true, nosort: true, w: "" },
  { key: "harga", label: "Harga", w: "w-28" },
  { key: "perubahan_pct", label: "Perubahan", w: "w-28" },
  { key: "foreign_flow", label: "Proksi Arus CMF", w: "w-28" },
  { key: "nilai", label: "Nilai (Rp)", w: "w-28" },
  { key: "mcap", label: "M.Cap", w: "w-28" },
  { key: "per", label: "PER", w: "w-20" },
  { key: "pbv", label: "PBV", w: "w-20" },
  { key: "yield_pct", label: "Yield", w: "w-20" },
  { key: "roe", label: "ROE", w: "w-20" },
] as const;

function pageWindow(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

function roundToTick(price: number, dir: "floor" | "ceil" | "round" = "round"): number {
  if (!price || price <= 0) return 0;
  let tick = 1;
  if (price >= 5000) tick = 25;
  else if (price >= 2000) tick = 10;
  else if (price >= 500) tick = 5;
  else if (price >= 200) tick = 2;
  else tick = 1;

  if (dir === "floor") return Math.floor(price / tick) * tick;
  if (dir === "ceil") return Math.ceil(price / tick) * tick;
  return Math.round(price / tick) * tick;
}

/* ── Watchlist Bar (Permanent & Fixed, independent of search & pagination) ── */
function WatchlistStrip({
  items,
  totalCount,
  isFilteringTable,
  onToggleFilter,
}: {
  items: ListItem[];
  totalCount: number;
  isFilteringTable: boolean;
  onToggleFilter: () => void;
}) {
  const router = useRouter();

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="ios-glass-canvas rounded-[24px] p-4 transition-colors">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-300">
            <span className="text-amber-500 text-sm">★</span> Watchlist ({totalCount})
          </span>
          <span className="hidden text-[11px] text-zinc-500 dark:text-zinc-400 sm:inline">
            · Pantauan tetap (tidak berubah saat search/halaman)
          </span>
        </div>

        <button
          onClick={onToggleFilter}
          title={isFilteringTable ? "Tampilkan semua saham kembali" : "Filter tabel hanya menampilkan saham watchlist"}
          className={`ios-glass-pill flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-xs transition hover:scale-102 ${
            isFilteringTable
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "text-amber-950 dark:text-amber-300 hover:bg-white/80"
          }`}
        >
          <span>{isFilteringTable ? "✓ Memfilter Tabel" : "Filter Tabel Saja"}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {items.map((s) => {
          const up = (s.perubahan_pct ?? 0) >= 0;
          return (
            <button
              key={s.kode}
              onClick={() => router.push(`/saham/${s.kode}`)}
              className="ios-glass-card group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs shadow-xs transition hover:scale-[1.02] hover:border-amber-400"
            >
              <StockLogo kode={s.kode} size="xs" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{s.kode}</span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{rp(s.harga)}</span>
              <span
                className={`font-semibold tabular-nums ${
                  up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {s.perubahan_pct === null ? "-" : `${up ? "+" : ""}${num(s.perubahan_pct, 1)}%`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StockList() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const q = sp.get("q") ?? "";
  const explicitSort = sp.get("sort");
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const grupParam = sp.get("grup") ?? "";

  const isWatchlistGrup = grupParam === "watchlist";
  const isSwingGrup = grupParam === "swing";
  const sort = explicitSort ?? (isSwingGrup ? "swing_prob" : "mcap");
  const grup = isWatchlistGrup
    ? "watchlist"
    : GROUPS.some((g) => g.id === grupParam) || grupParam.startsWith("sek:")
      ? grupParam
      : "semua";

  const grupLabel = isWatchlistGrup
    ? "⭐ Watchlist Anda"
    : isSwingGrup
      ? "⚡ Radar Fast Swing & Scalping (Target 1-3%)"
      : grup.startsWith("sek:")
        ? grup.slice(4)
        : (GROUPS.find((g) => g.id === grup)?.label ?? "Semua saham");

  const [searchDraft, setSearchDraft] = useState({ value: q, base: q });
  const search = searchDraft.base === q ? searchDraft.value : q;
  const setSearch = (value: string) => setSearchDraft({ value, base: q });
  const swingMsciOnly = sp.get("msciOnly") === "1";
  const superOnly = sp.get("super") === "1";
  const setSwingMsciOnly = (active: boolean) => update({ msciOnly: active ? "1" : null, page: null });
  const setSuperOnly = (active: boolean) => update({ super: active ? "1" : null, page: null });
  const filterValues = Object.fromEntries(FILTER_PARAMS.flatMap((k) => (sp.get(k) ? [[k, sp.get(k)!]] : [])));
  const filterStr = new URLSearchParams(filterValues).toString();
  const [refreshing, setRefreshing] = useState(false);
  const { sectorReport, refreshSectors, sentimentFilter, setSentimentFilter, radarOpen: showMarketRadar, setRadarOpen: setShowMarketRadar, radarHeading, openRadar } = useHomeMarket();
  const [macroEvents, setMacroEvents] = useState<MacroEvent[] | null>(null);
  const [agendaError, setAgendaError] = useState(false);
  const [selectedMacroEvent, setSelectedMacroEvent] = useState<MacroEvent | null>(null);
  const sektor = sectorReport?.sektor ?? [];

  // Dynamic Macro Events fetcher from /api/makro
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/makro", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Agenda tidak tersedia.");
        const { upcomingEvents }: { upcomingEvents: MacroEvent[] } = await r.json();
        if (!controller.signal.aborted) setMacroEvents(upcomingEvents.filter((event) => event.countdownDays >= 0).slice(0, 5));
      })
      .catch(() => { if (!controller.signal.aborted) setAgendaError(true); });
    return () => controller.abort();
  }, []);

  /* ── Watchlist data integration ────────────────────────────────────────── */
  const { list: watchList } = useWatchlist();
  const watchSet = useMemo(() => new Set(watchList), [watchList]);
  const watchKey = useMemo(() => [...watchList].sort().join(","), [watchList]);

  // Dedicated fetch for Watchlist strip items: NEVER touched by search bar or page!
  const [watchlistItems, setWatchlistItems] = useState<ListItem[]>([]);

  useEffect(() => {
    if (!watchKey) return;
    const ctrl = new AbortController();
    fetch(`/api/saham?kodes=${watchKey}&size=300`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: ListItem[] } | null) => {
        if (!ctrl.signal.aborted && j?.items) {
          setWatchlistItems(j.items);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [watchKey]);

  /* ── Paper Trading simulation integration ──────────────────────────────── */
  const { openTrade, openBatchTrades, openTrades, closeAllTrades, refreshWithLivePrices, loadingPrices, priceCheckMessage } = usePaperTrading();
  const simulatedSet = useMemo(() => new Set(openTrades.map((t) => t.kode)), [openTrades]);
  const [simToast, setSimToast] = useState<{ msg: string; kode: string } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const handleCloseBatchInStockList = () => {
    if (openTrades.length === 0) return;

    if (!window.confirm(`Tutup semua ${openTrades.length} posisi aktif di harga terakhir yang tercatat?`)) return;

    const res = closeAllTrades();
    if (res.count > 0) {
      setSimToast({
        msg: `${res.count} posisi ditutup manual. Total PnL terealisasi ${res.totalPnlRp >= 0 ? "+" : ""}${rp(res.totalPnlRp)}.`,
        kode: "CLOSE_ALL",
      });
      setTimeout(() => setSimToast(null), 8000);
    }
  };

  const handleSimulateBuy = (
    s: Pick<ListItem, "kode" | "nama" | "harga" | "foreign_status">,
    score: number | undefined,
    isMsci: boolean,
    source: "swing" | "news" = "swing",
  ) => {
    if (!s.harga || s.harga <= 0) return;
    // Dynamic lot calculation targeted around ~Rp 5 - 10 Juta per position
    const recommendedLot = Math.max(5, Math.min(100, Math.round(5_000_000 / (s.harga * 100))));
    const entry = Math.round(s.harga);
    const projection = source === "news" ? projectSwingPrices(entry) : null;

    const trade = openTrade({
      kode: s.kode,
      nama: s.nama,
      entryPrice: s.harga,
      lot: recommendedLot,
      convictionScore: score,
      isMsci,
      targetTp1Pct: projection ? (projection.tp1 / entry - 1) * 100 : 1.5,
      targetTp2Pct: projection ? (projection.tp2 / entry - 1) * 100 : 3.0,
      stopLossPct: projection ? (projection.downside / entry - 1) * 100 : -2.0,
      notes: source === "news" ? "Radar Berita" : `Radar Swing · Skor ${score ?? "belum tersedia"} · Sinyal ${s.foreign_status || "Akumulasi Support"}`,
    });

    setSimToast({
      msg: trade
        ? `Posisi Paper Trade dibuka untuk ${s.kode} di ${rp(trade.entryPrice)} (${recommendedLot} Lot). TP1 ${rp(trade.targetTp1)}, TP2 ${rp(trade.targetTp2)}, SL ${rp(trade.stopLoss)}.`
        : `Saldo simulasi belum cukup untuk membuka ${recommendedLot} lot ${s.kode}.`,
      kode: s.kode,
    });

    setTimeout(() => {
      setSimToast(null);
    }, 6000);
  };

  const handleBatchSimulateSwing = async () => {
    setBatchLoading(true);
    try {
      const res = await fetch(`/api/saham?grup=swing&super=${superOnly ? "1" : "0"}&size=100`);
      if (!res.ok) throw new Error("Gagal mengambil daftar swing");
      const json = await res.json();
      const swingItems: ListItem[] = json.items || [];

      const filteredItems = (!superOnly && swingMsciOnly)
        ? swingItems.filter((s) => MSCI_STANDARD_SET.has(s.kode) || MSCI_SMALLCAP_SET.has(s.kode))
        : swingItems;

      if (filteredItems.length === 0) {
        alert("Tidak ada saham radar swing yang tersedia saat ini.");
        return;
      }

      const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      const batchTitle = superOnly ? `Batch Super Picks ${todayStr}` : `Batch Swing Terkurasi ${todayStr}`;
      const count = openBatchTrades(
        filteredItems.map((s) => {
          const isStandard = MSCI_STANDARD_SET.has(s.kode);
          const isSmallCap = MSCI_SMALLCAP_SET.has(s.kode);
          const isSuper = s.swing_tier === "SUPER";
          const score = s.swing_prob ?? undefined;
          return {
            kode: s.kode,
            nama: s.nama,
            entryPrice: s.harga || 0,
            convictionScore: score,
            isMsci: isStandard || isSmallCap,
            notes: `${isSuper ? "💎 Super Pick " : "⚡ Pilihan Utama "}· Skor ${score ?? "belum tersedia"} · Sinyal ${s.foreign_status || "Akumulasi Support"}`,
          };
        }),
        batchTitle
      );

      if (count > 0) {
        setSimToast({
          msg: `🎉 ${count} saham ${superOnly ? "Super Picks" : "Swing Terkurasi (Super + Pilihan Utama)"} hari ini berhasil dimasukkan ke Simulasi! Besok sistem otomatis mengevaluasi target TP1/TP2 vs SL.`,
          kode: "BATCH",
        });
      } else {
        setSimToast({
          msg: "Tidak ada posisi baru. Periksa saldo, harga masuk, dan posisi yang sudah aktif.",
          kode: "INFO",
        });
      }
    } catch {
      alert("Terjadi kendala saat memproses simulasi batch");
    } finally {
      setBatchLoading(false);
    }
  };

  const [result, setResult] = useState<{ key: string; grup: string; data?: ListResponse; error?: string } | null>(null);
  const key = `${page}|${q}|${explicitSort ?? ""}|${dir}|${grup}|${isSwingGrup ? (superOnly ? "super" : swingMsciOnly ? "msci" : "all") : ""}|${grup === "watchlist" ? watchKey : ""}|${sentimentFilter ? sentimentFilter.kodes.join(",") : ""}|${filterStr}`;

  const apiParams = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(filterStr);
    for (const [k, v] of Object.entries({ page: String(page), q, dir, ...extra })) {
      p.set(k, v);
    }
    if (explicitSort) p.set("sort", explicitSort);
    if (sentimentFilter && sentimentFilter.kodes.length > 0) {
      p.set("kodes", sentimentFilter.kodes.join(","));
    } else if (grup === "watchlist") {
      p.set("kodes", watchList.length > 0 ? watchList.join(",") : "__NONE__");
    } else {
      p.set("grup", grup);
      if (isSwingGrup) {
        p.set("super", superOnly ? "1" : "0");
        if (swingMsciOnly) p.set("msciOnly", "1");
      }
    }
    return p;
  };

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    if (p.get("grup") !== "swing") {
      p.delete("super");
      p.delete("msciOnly");
    }
    router.replace(p.size ? `${pathname}?${p}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search.trim(), page: null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = apiParams();
    fetch(`/api/saham?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Gagal mengambil data");
        if (!ctrl.signal.aborted) setResult({ key, grup, data: j });
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setResult({ key, grup, error: e instanceof Error ? e.message : String(e) });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [auto, setAuto] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function exportScreenerCSV() {
    setExporting(true);
    try {
      const params = apiParams({ page: "1", size: "1000" });
      const res = await fetch(`/api/saham?${params}`);
      const j = await res.json();
      const exportItems: ListItem[] = j.items || [];
      const headers = ["Kode","Nama","Papan","Sektor","Harga","Perubahan%","Nilai","MarketCap","PER","PBV","Yield%","ROE%"];
      const rows = exportItems.map((s) => [
        s.kode, s.nama, s.papan, s.sektor || "-",
        s.harga || 0, s.perubahan_pct ? num(s.perubahan_pct, 2) : 0,
        s.nilai || 0, s.mcap || 0,
        s.per ? num(s.per, 2) : "-", s.pbv ? num(s.pbv, 2) : "-",
        s.yield_pct ? num(s.yield_pct, 2) : "-", s.roe ? num(s.roe, 2) : "-",
      ]);
      const csv = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url; a.download = `screener_ihsg_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { alert("Gagal mengekspor data"); }
    finally { setExporting(false); }
  }

  useEffect(() => {
    if (!auto) return;
    const params = apiParams();
    const ctrl = new AbortController();
    const t = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/saham?${params}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: ListResponse | null) => {
          if (j && !ctrl.signal.aborted) setResult({ key, grup, data: j });
        })
        .catch(() => {});
    }, 25_000);
    return () => {
      clearInterval(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, key]);

  async function refresh() {
    setRefreshing(true);
    try {
      const params = apiParams({ refresh: "1" });
      const r = await fetch(`/api/saham?${params}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gagal menyegarkan data");
      setResult({ key, grup, data: j });
      void refreshSectors();
    } catch (e) {
      setResult({ key, grup, error: e instanceof Error ? e.message : String(e) });
    } finally { setRefreshing(false); }
  }

  const current = result?.key === key ? result : null;
  const data = (current ?? (result?.grup === grup ? result : null))?.data;
  const loading = !current;
  const updated = data
    ? new Date(data.updatedAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "medium" })
    : null;

  const aktifFilter = FILTER_PARAMS.filter((k) => filterValues[k]).length;

  const showcaseItems = data?.items.slice(0, 2) ?? [];

  return (
    <section aria-labelledby="screener-title" className="screen-shell space-y-5 py-5">

      {/* ── Top bar: title + search + actions (Satoshi Style) ────── */}
      <div className="crystal-intro flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 id="screener-title" className="crystal-title">{grupLabel}</h1>
            {isWatchlistGrup && (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Filter Aktif
              </span>
            )}
          </div>
          <Link href="/seleksi-investasi" className="ios-glass-pill control-button rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300">
            Seleksi Saham Investasi →
          </Link>
        </div>

        <div className="grid w-full min-w-0 grid-cols-2 items-stretch gap-2 sm:flex sm:flex-wrap sm:items-center lg:w-auto">
          <div className="relative col-span-full w-full sm:w-64">
            <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
              🔍
            </span>
            <input
              type="search"
              aria-label="Cari kode atau nama emiten"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode atau nama emiten..."
              className="ios-glass-pill min-h-11 w-full rounded-full pl-9 pr-4 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:ring-2 focus:ring-[#9A83FF]/40 text-[#191919] dark:text-white"
            />
          </div>
          <button
            onClick={exportScreenerCSV}
            disabled={exporting}
            title="Unduh hasil filter ke CSV / Excel"
            className="control-button ios-glass-pill rounded-full py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 shadow-xs transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            ↓ {exporting ? "..." : "CSV"}
          </button>
          <label className="control-button ios-glass-subtle cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400 px-3 py-1.5 rounded-full">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[#22C55E] h-3.5 w-3.5 rounded" />
            <LiveBadge label="Otomatis 25 dtk" />
          </label>
          <button
            type="button"
            aria-controls="market-radar-panel"
            aria-expanded={showMarketRadar}
            onClick={() => openRadar()}
            className="control-button ios-glass-pill rounded-full py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 shadow-xs transition hover:scale-[1.02] active:scale-95"
          >
            Radar Pasar ↓
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Muat ulang data harga sekarang"
            className="control-button rounded-full crystal-primary py-2 text-xs font-bold transition active:scale-95 disabled:opacity-60"
          >
            {refreshing ? "Memuat..." : "↻ Perbarui"}
          </button>
        </div>
      </div>

      {/* ── Macro Event Detail Modal (iOS Crystal Clear Style) ── */}
      {selectedMacroEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="ios-glass-canvas viewport-dialog relative w-full max-w-xl space-y-4 rounded-3xl p-4 shadow-2xl sm:p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200/70 pb-3.5 dark:border-white/10">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{selectedMacroEvent.flag || "📅"}</span>
                  <span className="rounded-full bg-[#191919] px-2.5 py-0.5 text-[10px] font-black text-white dark:bg-white dark:text-[#191919]">
                    {selectedMacroEvent.currency || selectedMacroEvent.category}
                  </span>
                  <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-black text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-700 dark:text-emerald-300">
                    {selectedMacroEvent.countdownDays === 0
                      ? "Hari Ini"
                      : selectedMacroEvent.countdownDays === 1
                        ? "Besok"
                        : `${selectedMacroEvent.countdownDays} Hari Lagi`}
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#191919] dark:text-white leading-snug">
                  {selectedMacroEvent.title}
                </h3>
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  {selectedMacroEvent.date} {selectedMacroEvent.timeWib ? `· ${selectedMacroEvent.timeWib}` : ""} · Sumber: {selectedMacroEvent.source}
                </p>
              </div>
              <button
                onClick={() => setSelectedMacroEvent(null)}
                className="rounded-full h-8 w-8 flex items-center justify-center border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition shrink-0 shadow-xs font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Description & Impact */}
            <div className="space-y-3 text-xs leading-relaxed">
              <div className="ios-glass-subtle rounded-[22px] p-4 space-y-1.5 border border-zinc-200/80 dark:border-white/10">
                <div className="font-black text-[#191919] dark:text-white text-xs flex items-center gap-1.5">
                  <span>📊</span>
                  <span>Pengaruh Terhadap IHSG &amp; Transmisi Moneter:</span>
                </div>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  {selectedMacroEvent.pengaruhKeIhsg || selectedMacroEvent.description}
                </p>
              </div>

              {selectedMacroEvent.tipsAksiTrader && (
                <div className="ios-glass-subtle rounded-[22px] p-4 space-y-1.5 border border-zinc-200/80 dark:border-white/10">
                  <div className="font-black text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <span>💡</span>
                    <span>Tips Aksi Trader:</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                    {selectedMacroEvent.tipsAksiTrader}
                  </p>
                </div>
              )}

              {selectedMacroEvent.sahamPilihan && selectedMacroEvent.sahamPilihan.length > 0 && (
                <div className="flex items-center justify-between gap-2 pt-1 px-1">
                  <span className="font-extrabold text-zinc-700 dark:text-zinc-300 text-xs">
                    Saham Paling Terdampak:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedMacroEvent.sahamPilihan.map((k) => (
                      <span key={k} className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-black text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-700 dark:text-emerald-300 shadow-2xs">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-zinc-200/70 dark:border-white/10 min-w-0">
              <Link
                href="/pasar?tab=makro"
                onClick={() => setSelectedMacroEvent(null)}
                className="text-xs font-bold text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Buka Dashboard Makro Lengkap</span>
                <span>&rarr;</span>
              </Link>

              {selectedMacroEvent.sahamPilihan && selectedMacroEvent.sahamPilihan.length > 0 && (
                <button
                  onClick={() => {
                    setSentimentFilter({
                      kodes: selectedMacroEvent.sahamPilihan!,
                      label: selectedMacroEvent.title,
                    });
                    setSelectedMacroEvent(null);
                    const el = document.getElementById("screener-table-header");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-full bg-[#191919] text-white hover:bg-black dark:bg-white dark:text-[#191919] px-4 py-2 text-xs font-black shadow-md hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-1.5 shrink-0 max-w-full"
                >
                  <span className="shrink-0">🔍</span>
                  <span className="truncate">Filter di Tabel ({selectedMacroEvent.sahamPilihan.join(", ")})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ── Classy Unified Command Bar (iOS Crystal Clear Style) ── */}
      <div id="screener-table-header" tabIndex={-1} className="ios-glass-canvas flex scroll-mt-32 flex-wrap items-center justify-between gap-3 rounded-3xl p-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500">
        {/* Left: Mode Segmented Switch (iOS Style) */}
        <div className="flex flex-wrap items-center gap-1 rounded-full ios-glass-subtle p-1">
          <button
            onClick={() => {
              setSentimentFilter(null);
              update({ grup: isSwingGrup ? null : "swing", page: null });
            }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              isSwingGrup
                ? "crystal-active"
                : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span>⚡</span>
            <span>Radar Swing</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                isSwingGrup
                  ? "bg-[#9A83FF] text-white"
                  : "bg-[#9A83FF]/15 text-[#9A83FF] dark:bg-[#9A83FF]/25 dark:text-[#9A83FF]"
              }`}
            >
              1-3%
            </span>
          </button>

          <button
            onClick={() => {
              setSentimentFilter(null);
              update({ grup: null, page: null });
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              (!grup || grup === "semua") && !sentimentFilter
                ? "crystal-active"
                : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            Semua Saham
          </button>

          <button
            onClick={() => {
              setSentimentFilter(null);
              update({ grup: isWatchlistGrup ? null : "watchlist", page: null });
            }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              isWatchlistGrup
                ? "crystal-active"
                : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span>★</span>
            <span>Watchlist</span>
            {watchList.length > 0 && <span className="text-[10px] opacity-80">({watchList.length})</span>}
          </button>

          {sentimentFilter && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/80 dark:text-emerald-200 shadow-2xs">
              <span>🔥</span>
              <span>Filter Sentimen: {sentimentFilter.label}</span>
              <button
                onClick={() => setSentimentFilter(null)}
                className="ml-1 rounded-full bg-emerald-200/90 px-1.5 py-0.2 text-[10px] hover:bg-emerald-300 dark:bg-emerald-800 dark:hover:bg-emerald-700 transition"
                title="Hapus filter rekomendasi sentimen"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right: Dropdowns (Indeks Acuan, Sektor & Papan, Preset Strategi) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Indeks Dropdown */}
          <div className="relative">
            <select
              aria-label="Indeks acuan"
              value={
                ["msci-standard", "msci-smallcap", "msci-all", "idx30", "lq45", "highdiv20"].includes(grup)
                  ? grup
                  : ""
              }
              onChange={(e) => update({ grup: e.target.value || null, page: null })}
              className={`cursor-pointer appearance-none rounded-full px-3.5 py-1.5 pr-7 text-xs font-semibold outline-none transition ${
                ["msci-standard", "msci-smallcap", "msci-all", "idx30", "lq45", "highdiv20"].includes(grup)
                  ? "bg-[#191919] font-bold text-white dark:bg-white dark:text-[#191919] shadow-xs"
                  : "ios-glass-pill text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <option value="">Indeks Acuan ▾</option>
              <option value="msci-standard">🌍 MSCI Standard (Top 25)</option>
              <option value="msci-smallcap">🌐 MSCI Small Cap (58 Saham)</option>
              <option value="msci-all">🌐 MSCI IMI (Semua 83)</option>
              <option value="idx30">🏛 IDX30 (Likuiditas Jumbo)</option>
              <option value="lq45">📈 LQ45 (Top 45)</option>
              <option value="highdiv20">💰 High Dividend 20</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] text-zinc-400">▾</span>
          </div>

          {/* 2. Sektor & Papan Dropdown */}
          <div className="relative">
            <select
              aria-label="Sektor atau papan pencatatan"
              value={
                grup.startsWith("sek:") ||
                ["utama", "pengembangan", "akselerasi", "ekonomibaru", "pemantauan"].includes(grup)
                  ? grup
                  : ""
              }
              onChange={(e) => {
                setSentimentFilter(null);
                update({ grup: e.target.value || null, page: null });
              }}
              className={`cursor-pointer appearance-none rounded-full px-3.5 py-1.5 pr-7 text-xs font-semibold outline-none transition ${
                grup.startsWith("sek:") ||
                ["utama", "pengembangan", "akselerasi", "ekonomibaru", "pemantauan"].includes(grup)
                  ? "bg-[#9A83FF] font-bold text-white shadow-xs"
                  : "ios-glass-pill text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <option value="">Sektor &amp; Papan ▾</option>
              <optgroup label="Sektor Industri (IDX-IC)">
                {sektor.map((s) => (
                  <option key={s.nama} value={`sek:${s.nama}`}>
                    {s.nama}{" "}
                    {s.perubahan_pct !== null ? `(${signedPct(s.perubahan_pct, 1)})` : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Papan Pencatatan">
                <option value="utama">Papan Utama</option>
                <option value="pengembangan">Papan Pengembangan</option>
                <option value="ekonomibaru">Papan Ekonomi Baru</option>
                <option value="akselerasi">Papan Akselerasi</option>
                <option value="pemantauan">Papan Pemantauan Khusus</option>
              </optgroup>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] text-zinc-400">▾</span>
          </div>

          {/* 3. Preset Strategi Dropdown */}
          <div className="relative">
            <select
              aria-label="Preset strategi"
              value={
                STRATEGY_PRESETS.find((p) => Object.entries(p.v).every(([k, v]) => filterValues[k] === v))?.id ?? ""
              }
              onChange={(e) => {
                const found = STRATEGY_PRESETS.find((p) => p.id === e.target.value);
                const nextParams: Record<string, string | null> = {};
                for (const k of FILTER_PARAMS) nextParams[k] = null;
                if (found) {
                  for (const [k, v] of Object.entries(found.v)) nextParams[k] = v;
                }
                update(nextParams);
              }}
              className={`cursor-pointer appearance-none rounded-xl border px-3 py-1.5 pr-7 text-xs font-semibold outline-none transition ${
                STRATEGY_PRESETS.some((p) => Object.entries(p.v).every(([k, v]) => filterValues[k] === v))
                  ? "border-[#191919] bg-[#191919] font-bold text-white dark:border-white dark:bg-white dark:text-[#191919]"
                  : "border-zinc-200/80 bg-white/90 text-zinc-700 hover:border-zinc-300 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300"
              }`}
            >
              <option value="">Preset Strategi ▾</option>
              {STRATEGY_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.badge}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] text-zinc-400">▾</span>
          </div>

          {/* Reset Filters button if any active */}
          {(grup || aktifFilter > 0) && (
            <button
              onClick={() => {
                const resetParams: Record<string, string | null> = { grup: null, page: null };
                for (const k of FILTER_PARAMS) resetParams[k] = null;
                update(resetParams);
              }}
              title="Reset seluruh filter & kembali ke Semua Saham"
              className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-400 hover:text-[#FB6767] transition"
            >
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Filter panel (compact, collapsible) ───────────────── */}
      <FilterPanel
        key={filterStr}
        values={filterValues}
        query={sp.toString()}
        onApply={update}
        onOpenSaved={(params) => {
          setSearch(q);
          setSentimentFilter(null);
          update(params);
        }}
      />

      {/* ── Executive Swing Card (Satoshi Clean & Classy) ── */}
      {isSwingGrup && (
        <div className="ios-glass-canvas relative overflow-hidden rounded-[32px] p-6 shadow-2xl border border-zinc-200/80 dark:border-white/10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Clean Identity */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#191919] text-xs font-black text-white dark:bg-white dark:text-[#191919]">
                  ⚡
                </span>
                <h2 className="font-extrabold text-[#191919] dark:text-white text-base tracking-tight">
                  {superOnly
                    ? "Radar Super Picks"
                    : "Radar Swing Terkurasi"}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
                Skor swing memakai likuiditas dan proksi arus dari Chaikin Money Flow. Cut loss tabel memakai acuan 1,5%. Posisi baru di simulasi memakai stop loss 2%.
              </p>
            </div>

            {/* Right: Key Target Metrics (Satoshi Minimalist) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] px-1.5 py-2 text-center sm:px-3.5 dark:border-white/10 dark:bg-white/[0.05] shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400">Target TP1</div>
                <div className="text-xs font-black text-[#22C55E]">+1.5%</div>
              </div>
              <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] px-1.5 py-2 text-center sm:px-3.5 dark:border-white/10 dark:bg-white/[0.05] shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400">Target TP2</div>
                <div className="text-xs font-black text-[#22C55E]">+3.0%</div>
              </div>
              <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] px-1.5 py-2 text-center sm:px-3.5 dark:border-white/10 dark:bg-white/[0.05] shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400">Cut loss tabel</div>
                <div className="text-xs font-black text-rose-700 dark:text-rose-400">−1,5%</div>
              </div>
            </div>
          </div>

          {/* Bottom Action Bar: Segmented Switch + 1 Primary Action + Clean Position Menu */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/60 dark:border-white/[0.06] pt-4">
            {/* Toggle: Semua Terpilih vs Super Picks */}
            <div className="flex flex-wrap items-center rounded-2xl bg-[#F8F7F7] p-1 dark:bg-white/[0.05]">
              <button
                onClick={() => setSuperOnly(false)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  !superOnly
                    ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                    : "text-zinc-500 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                🌟 Semua Terkurasi
              </button>
              <button
                onClick={() => setSuperOnly(true)}
                className={`flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  superOnly
                    ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                    : "text-zinc-500 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                <span>💎</span>
                <span>Super Picks Saja</span>
              </button>
            </div>

            {/* Action Buttons: 1 CTA + Position Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBatchSimulateSwing}
                disabled={batchLoading}
                className="flex items-center gap-1.5 rounded-xl bg-[#191919] hover:bg-black px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60 dark:bg-white dark:text-[#191919]"
              >
                <span>🧪</span>
                <span>{batchLoading ? "Memproses..." : "Simulasikan ke Paper Trade"}</span>
              </button>

              {/* Position Action Group */}
              {openTrades.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] p-1 dark:border-white/10 dark:bg-white/[0.05]">
                  <span className="px-2 text-[10px] font-bold text-zinc-500">
                    Posisi ({openTrades.length}):
                  </span>
                  <button
                    onClick={() => refreshWithLivePrices(true)}
                    disabled={loadingPrices}
                    className="control-button rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-zinc-100 disabled:opacity-60 dark:bg-[#191919] dark:text-emerald-300 transition shadow-2xs"
                  >
                    {loadingPrices ? "Mengecek…" : "Cek TP/SL"}
                  </button>
                  <button
                    onClick={handleCloseBatchInStockList}
                    className="rounded-xl bg-white px-2.5 py-1 text-[11px] font-bold text-[#FB6767] hover:bg-zinc-100 dark:bg-[#191919] transition shadow-2xs"
                    title="Tutup semua posisi pada harga terakhir yang tercatat"
                  >
                    Tutup Semua Manual
                  </button>
                </div>
              )}
              <span role="status" className="text-xs text-zinc-600 dark:text-zinc-400">{priceCheckMessage}</span>

              <Link
                href="/simulasi"
                className="control-button rounded-xl border border-zinc-200/80 bg-white/90 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300 transition shadow-2xs"
              >
                <span>📊 Kalender &rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Main table ──────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-200/80 px-4 py-3 dark:border-white/10 sm:px-5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 id="screener-results" className="text-sm font-bold">Hasil screener</h2>
            <p role="status" className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
              {data ? data.total.toLocaleString("id-ID") + " saham" : loading ? "Memuat hasil…" : ""}
            </p>
          </div>
          {updated && <p className="text-xs text-zinc-600 dark:text-zinc-400">Diperbarui {updated}</p>}
        </div>
        {current?.error && <div className="p-6 text-sm font-medium text-red-600 dark:text-red-400">Gagal memuat data: {current.error}</div>}

        {!data && loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-100 border-t-green-500 dark:border-zinc-800 dark:border-t-green-400" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Memuat data saham IHSG...</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Pemuatan pertama bisa memakan waktu hingga 1 menit.</p>
          </div>
        )}

        {data && (
          <div
            role="region"
            aria-labelledby="screener-results"
            aria-busy={loading}
            tabIndex={0}
            className={`table-scroll transition-opacity focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500 ${loading ? "opacity-50" : ""}`}
          >
            {isSwingGrup ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <th className="w-10 px-3 py-3.5 text-center"></th>
                    <th className="px-4 py-3.5 text-left">Emiten &amp; Sektor</th>
                    <th className="px-4 py-3.5 text-right">Harga Live</th>
                    <th className="px-4 py-3.5 text-center">Setup Sinyal</th>
                    <th className="px-4 py-3.5 text-center">Skor Swing</th>
                    <th className="px-4 py-3.5 text-right">Area Antre Beli (Best Bid)</th>
                    <th className="px-4 py-3.5 text-right">Target Profit (TP 1 &amp; 2)</th>
                    <th className="px-4 py-3.5 text-right">Cut Loss</th>
                    <th className="px-4 py-3.5 text-center">Risk : Reward</th>
                    <th className="px-4 py-3.5 text-right">Likuiditas / Asing</th>
                    <th className="px-4 py-3.5 text-center">Aksi Analisis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {(!superOnly && swingMsciOnly
                    ? data.items.filter((s) => MSCI_STANDARD_SET.has(s.kode) || MSCI_SMALLCAP_SET.has(s.kode))
                    : data.items
                  ).map((s) => {
                    const price = s.harga ?? 0;
                    const tp1Price = roundToTick(price * 1.015, "ceil");
                    const tp1Pct = price > 0 ? ((tp1Price - price) / price) * 100 : 1.5;
                    const tp2Price = roundToTick(price * 1.03, "ceil");
                    const tp2Pct = price > 0 ? ((tp2Price - price) / price) * 100 : 3.0;
                    const slPrice = roundToTick(price * 0.985, "floor");
                    const slPct = price > 0 ? ((slPrice - price) / price) * 100 : -1.5;
                    const entryLow = roundToTick(price * 0.995, "floor");

                    const isMsciStandard = MSCI_STANDARD_SET.has(s.kode);
                    const isMsciSmallCap = MSCI_SMALLCAP_SET.has(s.kode);
                    const isMsci = isMsciStandard || isMsciSmallCap;

                    const score = s.swing_prob ?? null;
                    let scoreBadge = "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
                    let scoreLabel = "Tinggi";
                    let barColor = "bg-emerald-500";

                    if (score !== null && score >= 80) {
                      scoreBadge = "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200";
                      scoreLabel = "Sangat Tinggi";
                      barColor = "bg-gradient-to-r from-emerald-500 to-teal-500";
                    } else if (score !== null && score < 70) {
                      scoreBadge = "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
                      scoreLabel = "Moderat";
                      barColor = "bg-amber-500";
                    }

                    let signalLabel = "🎯 Akumulasi Support";
                    let signalBadge = "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300";
                    if (s.foreign_status?.includes("Akumulasi") || (s.foreign_flow && s.foreign_flow > 500_000_000)) {
                      signalLabel = "🌊 Akumulasi (CMF)";
                      signalBadge = "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";
                    } else if (s.perubahan_pct !== null && s.perubahan_pct > 0 && s.perubahan_pct <= 2.5) {
                      signalLabel = "⚡ Pantulan Rebound";
                      signalBadge = "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300";
                    } else if (s.perubahan_pct !== null && s.perubahan_pct > 2.5) {
                      signalLabel = "🚀 Momentum Breakout";
                      signalBadge = "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950/50 dark:text-purple-300";
                    }

                    const isWatched = watchSet.has(s.kode);
                    const up = (s.perubahan_pct ?? 0) >= 0;

                    return (
                      <tr
                        key={s.kode}
                        onClick={() => router.push(`/saham/${s.kode}`)}
                        className={`cursor-pointer transition hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40 ${
                          s.swing_tier === "SUPER" ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.06]" : ""
                        } ${isWatched ? "bg-amber-50/30 dark:bg-amber-950/15" : ""}`}
                      >
                        <td className="pl-3 pr-1 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <StarButton kode={s.kode} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <StockLogo kode={s.kode} size="sm" />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link
                                  href={`/saham/${s.kode}`}
                                  className="font-black text-[#191919] hover:underline dark:text-white text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {s.kode}
                                </Link>
                                <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {s.papan}
                                </span>
                                {s.swing_tier === "SUPER" ? (
                                  <span
                                    title="Super Pick: Skor Swing 90+, Nilai Transaksi ≥ Rp20 miliar, Murni Net Foreign Buy, Konstituen MSCI"
                                    className="inline-flex items-center gap-0.5 rounded-md border border-[#9A83FF]/40 bg-[#9A83FF]/15 px-1.5 py-0.2 text-[10px] font-black text-[#9A83FF] dark:bg-[#9A83FF]/25 shadow-2xs"
                                  >
                                    <span>💎</span> Super Pick
                                  </span>
                                ) : s.swing_tier === "HIGH_CONVICTION" ? (
                                  <span
                                    title="Pilihan Utama: Skor 78-85%, Likuiditas Tebal, Zero Distribusi Asing"
                                    className="inline-flex items-center gap-0.5 rounded-md border border-zinc-300 bg-zinc-100 px-1.5 py-0.2 text-[10px] font-bold text-[#191919] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs"
                                  >
                                    <span>⚡</span> Pilihan Utama
                                  </span>
                                ) : null}
                                {isMsciStandard && (
                                  <span
                                    title="Konstituen MSCI Indonesia Standard Index (Foreign Large Cap Favorite)"
                                    className="inline-flex items-center gap-0.5 rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs"
                                  >
                                    <span>🌍</span> MSCI Standard
                                  </span>
                                )}
                                {isMsciSmallCap && (
                                  <span
                                    title="Konstituen MSCI Indonesia Small Cap Index (High Liquidity Mid/Small Cap)"
                                    className="inline-flex items-center gap-0.5 rounded-md border border-teal-300 bg-teal-50 px-1.5 py-0.2 text-[10px] font-bold text-teal-700 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 shadow-2xs"
                                  >
                                    <span>🌐</span> MSCI SmallCap
                                  </span>
                                )}
                              </div>
                              <div className="max-w-[170px] truncate text-xs text-zinc-600 dark:text-zinc-400">
                                {s.nama}
                              </div>
                              {s.sektor && (
                                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                  {s.sektor}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <div className="font-bold text-[#191919] dark:text-zinc-100">
                            <PriceFlash value={s.harga}>{rp(s.harga)}</PriceFlash>
                          </div>
                          <div className={`text-xs font-bold ${up ? "text-[#22C55E]" : "text-[#FB6767]"}`}>
                            {s.perubahan_pct === null ? "-" : `${up ? "+" : ""}${num(s.perubahan_pct, 2)}%`}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${signalBadge}`}>
                              {signalLabel}
                            </span>
                            {isMsci && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <span>🌍</span> Konstituen MSCI
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {score === null ? (
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">Belum tersedia</span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-sm tabular-nums text-[#191919] dark:text-white">
                                  {score}/100
                                </span>
                                <span className={`rounded-md border px-1.5 py-0.2 text-[10px] font-bold ${scoreBadge}`}>
                                  {scoreLabel}
                                </span>
                              </div>
                              <div className="w-16 bg-zinc-200/80 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <div className="font-bold text-[#191919] dark:text-zinc-100">
                            {rp(entryLow)} - {rp(price)}
                          </div>
                          <div className="text-[10px] text-zinc-400">Best Bid Area</div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-[#22C55E]">
                            <span>TP1: {rp(tp1Price)}</span>
                            <span className="text-[10px] font-semibold text-[#22C55E]/80">(+{num(tp1Pct, 1)}%)</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-xs font-extrabold text-[#22C55E]">
                            <span>TP2: {rp(tp2Price)}</span>
                            <span className="text-[10px] font-semibold text-[#22C55E]/80">(+{num(tp2Pct, 1)}%)</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <div className="font-bold text-[#FB6767] text-xs">
                            {rp(slPrice)}
                          </div>
                          <div className="text-[10px] font-semibold text-[#FB6767]">
                            {num(slPct, 1)}%
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center rounded-md bg-[#22C55E]/10 px-2 py-0.5 text-xs font-extrabold text-[#22C55E] border border-[#22C55E]/30">
                            1 : 2.0
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-xs">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {compact(s.nilai)}
                          </div>
                          {s.foreign_flow !== null && s.foreign_flow !== undefined ? (
                            <div className={`text-[11px] font-medium ${s.foreign_flow >= 0 ? "text-[#22C55E]" : "text-[#FB6767]"}`}>
                              {s.foreign_flow >= 0 ? "+" : ""}{compact(s.foreign_flow)} Flow
                            </div>
                          ) : (
                            <div className="text-[11px] text-zinc-400">-</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleSimulateBuy(s, score ?? undefined, isMsci)}
                              className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition shadow-2xs active:scale-95 ${
                                simulatedSet.has(s.kode)
                                  ? "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700"
                                  : "bg-[#191919] hover:bg-black text-white dark:bg-white dark:text-[#191919]"
                              }`}
                              title={simulatedSet.has(s.kode) ? "Saham ini sedang aktif disimulasikan di Paper Trading" : "Simulasikan Buy posisi paper trade"}
                            >
                              <span>{simulatedSet.has(s.kode) ? "✓" : "+"}</span>
                              <span>{simulatedSet.has(s.kode) ? "Di Simulasi" : "Simulasi"}</span>
                            </button>
                            <button
                              onClick={() => {
                                const msciInfo = isMsciStandard ? " (Konstituen MSCI Indonesia Standard Index)" : isMsciSmallCap ? " (Konstituen MSCI Small Cap Index)" : "";
                                window.dispatchEvent(
                                  new CustomEvent("open-ai-chat", {
                                    detail: {
                                      asset: s.kode,
                                      type: "stock",
                                      initialPrompt: `Tolong berikan analisis teknikal & panduan rencana trading swing 1-3% untuk saham ${s.kode}${msciInfo} pada harga live ${rp(s.harga)} dengan skor swing ${score ?? "belum tersedia"}. Bagaimana konfirmasi volume flow, pengaruh aliran dana asing MSCI, level support & resistance kunci, serta batasan risikonya?`,
                                    },
                                  })
                                );
                              }}
                              className="flex items-center gap-1 rounded-xl border border-[#9A83FF]/30 bg-[#9A83FF]/10 text-[#9A83FF] hover:bg-[#9A83FF]/20 px-2 py-1 text-xs font-bold shadow-2xs transition active:scale-95"
                              title="Buka AI Chatbot untuk analisis swing cepat"
                            >
                              <span>🤖</span>
                              <span>AI</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!(
                    !superOnly && swingMsciOnly
                      ? data.items.filter((s) => MSCI_STANDARD_SET.has(s.kode) || MSCI_SMALLCAP_SET.has(s.kode))
                      : data.items
                  ).length && (
                    <tr>
                      <td colSpan={11} className="px-6 py-14 text-center text-sm text-zinc-400 dark:text-zinc-500">
                        {superOnly ? (
                          <span>
                            Tidak ada saham yang memenuhi kriteria ketat <strong>Super Picks</strong> saat ini.{" "}
                            <button
                              onClick={() => setSuperOnly(false)}
                              className="font-bold text-amber-600 hover:underline dark:text-amber-400"
                            >
                              Buka semua radar swing
                            </button>
                          </span>
                        ) : swingMsciOnly ? (
                          <span>
                            Tidak ada saham konstituen MSCI yang sedang berada di rentang swing saat ini.{" "}
                            <button
                              onClick={() => setSwingMsciOnly(false)}
                              className="font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                            >
                              Tampilkan semua saham swing
                            </button>
                          </span>
                        ) : (
                          "Tidak ada saham yang memenuhi kriteria ketat swing trade 1-3% saat ini."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                  {COLS.map((c) => {
                    const active = sort === c.key;
                    const sortable = !("nosort" in c);
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={sortable && active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                        className={`whitespace-nowrap px-4 py-3.5 ${"left" in c ? "text-left" : "text-right"} ${c.w}`}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => update({ sort: c.key, dir: active && dir === "desc" ? "asc" : "desc", page: null })}
                            className="rounded uppercase hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 dark:hover:text-emerald-400"
                          >
                            {c.label}
                            {active && <span aria-hidden="true">{dir === "asc" ? " ▲" : " ▼"}</span>}
                          </button>
                        ) : c.label || <span className="sr-only">Watchlist</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {data.items.map((s) => {
                  const isWatched = watchSet.has(s.kode);
                  return (
                    <tr
                      key={s.kode}
                      onClick={() => router.push(`/saham/${s.kode}`)}
                      className={`cursor-pointer transition hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40 ${
                        isWatched ? "bg-amber-50/30 dark:bg-amber-950/15" : ""
                      }`}
                    >
                      <td className="pl-4 pr-1 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <StarButton kode={s.kode} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <StockLogo kode={s.kode} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                href={`/saham/${s.kode}`}
                                className="font-black text-[#191919] hover:underline dark:text-white text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {s.kode}
                              </Link>
                              {MSCI_STANDARD_SET.has(s.kode) && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  MSCI
                                </span>
                              )}
                              {MSCI_SMALLCAP_SET.has(s.kode) && (
                                <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[9px] font-bold text-teal-800 dark:bg-teal-950/70 dark:text-teal-300">
                                  MSCI-SC
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-medium">{s.papan}</div>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                        {s.nama}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                        <PriceFlash value={s.harga}>
                          {rp(s.harga)}
                        </PriceFlash>
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right tabular-nums font-bold ${
                          (s.perubahan_pct ?? 0) >= 0 ? "text-[#22C55E]" : "text-[#FB6767]"
                        }`}
                      >
                        {s.perubahan_pct === null ? "-" : `${s.perubahan_pct >= 0 ? "+" : ""}${num(s.perubahan_pct, 2)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-xs font-semibold">
                        {s.foreign_flow !== null && s.foreign_flow !== undefined ? (
                          <div className="flex flex-col items-end">
                            <span className={s.foreign_flow >= 0 ? "text-[#22C55E] font-bold" : "text-[#FB6767] font-bold"}>
                              {s.foreign_flow >= 0 ? "+" : ""}{compact(s.foreign_flow)}
                            </span>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                              {s.foreign_status || "Netral"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400 font-medium">
                        {compact(s.nilai)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400 font-medium">
                        {compact(s.mcap)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {s.per === null ? "-" : `${num(s.per, 1)}x`}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {s.pbv === null ? "-" : `${num(s.pbv, 2)}x`}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#22C55E]">
                        {pct(s.yield_pct)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {pct(s.roe, 1)}
                      </td>
                    </tr>
                  );
                })}
                {!data.items.length && (
                  <tr>
                    <td colSpan={COLS.length} className="px-6 py-14 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      {isWatchlistGrup ? (
                        <span>
                          Watchlist Anda masih kosong atau tidak cocok dengan pencarian &quot;{search}&quot;. Klik bintang{" "}
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">☆</span> pada saham untuk menambahkan.
                        </span>
                      ) : (
                        "Tidak ada saham yang cocok dengan filter atau kata kunci pencarian."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        )}
      </Card>

      {/* ── Pagination (Satoshi Active Pill) ─────────────────────── */}
      {data && data.pages > 1 && (
        <nav aria-label="Halaman hasil screener" className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Menampilkan halaman <strong>{data.page}</strong> dari {data.pages} ({data.total.toLocaleString("id-ID")} total saham)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              disabled={data.page <= 1}
              onClick={() => update({ page: String(data.page - 1) })}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Sebelumnya
            </button>
            {pageWindow(data.page, data.pages).map((n, i) =>
              n === "…" ? (
                <span key={`e${i}`} className="px-2 text-zinc-400">…</span>
              ) : (
                <button
                  key={n}
                  aria-current={n === data.page ? "page" : undefined}
                  onClick={() => update({ page: String(n) })}
                  className={`min-w-9 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    n === data.page
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              disabled={data.page >= data.pages}
              onClick={() => update({ page: String(data.page + 1) })}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Berikutnya →
            </button>
          </div>
        </nav>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-2 leading-relaxed">
        Data bersumber dari Yahoo Finance (tertunda 10–15 menit sesuai regulasi BEI). Bukan rekomendasi investasi.{" "}
        {aktifFilter > 0 && <span className="font-semibold text-amber-600 dark:text-amber-400">{aktifFilter} filter aktif diterapkan.</span>}
      </p>

      <WatchlistStrip
        items={watchlistItems.filter((item) => watchSet.has(item.kode))}
        totalCount={watchList.length}
        isFilteringTable={isWatchlistGrup}
        onToggleFilter={() => {
          update({ grup: isWatchlistGrup ? null : "watchlist", page: null });
          document.getElementById("screener-table-header")?.scrollIntoView();
        }}
      />

      <section aria-labelledby="market-radar-title" className="space-y-4">
        <div className="ios-glass-canvas flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
          <h2 id="market-radar-title" ref={radarHeading} tabIndex={-1} className="scroll-mt-32 rounded text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500">Radar Pasar</h2>
          <button type="button" aria-controls="market-radar-panel" aria-expanded={showMarketRadar} onClick={() => setShowMarketRadar((open) => !open)} className="ios-glass-pill min-h-10 rounded-full px-4 text-sm font-semibold">
            {showMarketRadar ? "Sembunyikan radar" : "Buka radar"}
          </button>
        </div>
        <div id="market-radar-panel" hidden={!showMarketRadar}>
          {showMarketRadar && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-8">
                <NewsSentimentRecommendations
                  onFilterTableKodes={(kodes, label) => {
                    setSentimentFilter({ kodes, label });
                    const el = document.getElementById("screener-table-header");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  onSimulateBuy={(item) => handleSimulateBuy(item, undefined, false, "news")}
                  activeFilter={sentimentFilter}
                  onClearFilter={() => setSentimentFilter(null)}
                />
              </div>

              {/* Right: Key Macro Events & Most Active Tickers (4 cols) */}
              <div className="xl:col-span-4 space-y-4">
                {/* 1. Macro Calendar Events Agenda (Dynamic from /api/makro) */}
                <div className="ios-glass-canvas rounded-[28px] p-5 space-y-3.5 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-zinc-200/50 pb-3 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9A83FF]/15 text-xs text-[#9A83FF]">
                        📅
                      </span>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#191919] dark:text-white">
                        Agenda Makro Kunci
                      </h3>
                    </div>
                    <Link
                      href="/pasar?tab=makro"
                      title="Buka dashboard makroekonomi, The Fed, & kalender global"
                      className="group inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white transition"
                    >
                      <span>Dashboard Makro</span>
                      <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {agendaError ? <p role="status" className="text-xs text-zinc-600 dark:text-zinc-400">Agenda tidak tersedia.</p>
                      : macroEvents === null ? <p role="status" className="text-xs text-zinc-600 dark:text-zinc-400">Memuat agenda…</p>
                      : macroEvents.length === 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400">Belum ada agenda mendatang.</p>}
                    {macroEvents?.map((evt) => {
                      const picks = evt.sahamPilihan || [];
                      const displayCountdown =
                        evt.countdownDays === 0
                          ? "Hari Ini"
                          : evt.countdownDays === 1
                            ? "Besok"
                            : evt.countdownDays > 1
                              ? `${evt.countdownDays} hr lagi`
                              : evt.date;

                      return (
                        <button
                          key={evt.id || evt.title}
                          type="button"
                          onClick={() => setSelectedMacroEvent(evt)}
                          title="Klik untuk melihat analisis transmisi moneter & dampak saham"
                          className="ios-glass-card group flex w-full items-center justify-between gap-3 rounded-[18px] p-2.5 text-left transition hover:scale-[1.01] hover:shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs">{evt.flag || "🌐"}</span>
                              <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.2 text-[9px] font-black text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                                {evt.currency || evt.category || "MAKRO"}
                              </span>
                              <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                                {displayCountdown}
                              </span>
                            </div>
                            <div className="mt-1 truncate text-xs font-bold text-[#191919] group-hover:text-zinc-700 dark:text-zinc-200 dark:group-hover:text-white">
                              {evt.title}
                            </div>
                          </div>
                          {picks.length > 0 && (
                            <div className="shrink-0 text-right">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSentimentFilter({ kodes: picks, label: evt.title });
                                  const el = document.getElementById("screener-table-header");
                                  if (el) el.scrollIntoView({ behavior: "smooth" });
                                }}
                                title={`Filter tabel saham langsung: ${picks.join(", ")}`}
                                className="inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/30 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 transition"
                              >
                                {picks.slice(0, 2).join(", ")}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tickers from the current screener results */}
                <div className="ios-glass-canvas rounded-[28px] p-5 space-y-3.5 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-zinc-200/50 pb-3 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-600">
                        📈
                      </span>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#191919] dark:text-white">
                        Saham dari hasil screener
                      </h3>
                    </div>
                    <Link
                      href="/?grup=swing"
                      className="group inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-[#191919] dark:hover:text-white transition"
                    >
                      <span>Radar Swing</span>
                      <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                    </Link>
                  </div>

                  {showcaseItems.length === 0 && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Belum ada saham untuk ditampilkan.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2.5">
                    {showcaseItems.map((item) => {
                      const up = (item.perubahan_pct ?? 0) >= 0;
                      return (
                        <Link
                          key={item.kode}
                          href={`/saham/${item.kode}`}
                          className="ios-glass-card group relative flex flex-col justify-between overflow-hidden rounded-[20px] p-3 transition hover:scale-[1.02] hover:shadow-md"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <StockLogo kode={item.kode} size="xs" />
                              <div className="min-w-0">
                                <div className="text-xs font-black text-[#191919] group-hover:underline dark:text-white">
                                  {item.kode}
                                </div>
                                <div className="truncate text-[9px] text-zinc-400 font-medium">
                                  {item.nama}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 flex items-baseline justify-between">
                              <span className="text-xs font-black text-[#191919] dark:text-white tabular-nums">
                                {rp(item.harga)}
                              </span>
                              <span className={`text-[10px] font-bold tabular-nums ${up ? "text-[#22C55E]" : "text-[#FB6767]"}`}>
                                {item.perubahan_pct !== null && item.perubahan_pct !== undefined
                                  ? `${up ? "+" : ""}${num(item.perubahan_pct, 1)}%`
                                  : "-"}
                              </span>
                            </div>
                          </div>

                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Floating Notification Toast for Paper Trade Simulation ── */}
      {simToast && (
        <div className="fixed inset-x-3 bottom-32 z-[60] flex max-w-md flex-wrap items-center gap-2 sm:inset-x-auto sm:bottom-24 sm:right-6 rounded-2xl border border-emerald-500/40 bg-zinc-950/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-2xl ring-1 ring-emerald-500/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-sm shadow-emerald-700/40">
            ✓
          </span>
          <div className="min-w-0 flex-1 basis-36 space-y-0.5 wrap-anywhere">
            <div className="font-bold text-emerald-300">Simulasi Paper Trade Berhasil Dibuka!</div>
            <div className="text-[11px] leading-tight text-zinc-300">{simToast.msg}</div>
          </div>
          <Link
            href="/simulasi"
            className="ml-1 shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 font-bold text-white shadow-sm hover:brightness-110 whitespace-nowrap text-center"
          >
            Buka Simulasi &rarr;
          </Link>
          <button
            onClick={() => setSimToast(null)}
            className="text-zinc-400 hover:text-white p-1 text-xs"
            title="Tutup pemberitahuan"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
