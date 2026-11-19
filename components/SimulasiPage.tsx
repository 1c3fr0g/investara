"use client";

import { useState } from "react";
import Link from "next/link";
import {
  usePaperTrading,
  type PaperTrade,
  type TradeStatus,
} from "@/lib/paperTrading";
import { StockLogo } from "./StockLogo";
import { PriceFlash } from "./PriceFlash";
import { rp, num, pct, compact } from "@/lib/format";
import { Card } from "./ui";
import { SwingCalendar } from "./SwingCalendar";

const POPULAR_TICKERS = [
  { kode: "BBCA", nama: "Bank Central Asia Tbk", defaultPrice: 10250 },
  { kode: "BBRI", nama: "Bank Rakyat Indonesia Tbk", defaultPrice: 4750 },
  { kode: "BMRI", nama: "Bank Mandiri Tbk", defaultPrice: 6600 },
  { kode: "BBNI", nama: "Bank Negara Indonesia Tbk", defaultPrice: 5300 },
  { kode: "TLKM", nama: "Telkom Indonesia Tbk", defaultPrice: 2880 },
  { kode: "ASII", nama: "Astra International Tbk", defaultPrice: 5050 },
  { kode: "BRIS", nama: "Bank Syariah Indonesia Tbk", defaultPrice: 3000 },
  { kode: "ADRO", nama: "Adaro Energy Indonesia Tbk", defaultPrice: 3750 },
  { kode: "AMMN", nama: "Amman Mineral Internasional Tbk", defaultPrice: 8900 },
  { kode: "MEDC", nama: "Medco Energi Internasional Tbk", defaultPrice: 1250 },
];

export function SimulasiPage() {
  const {
    trades,
    openTrades,
    closedTrades,
    summary,
    dailyPerformance,
    batchPerformance,
    closeTrade,
    closeAllTrades,
    deleteTrade,
    resetTrades,
    restoreDefaultSeedTrades,
    setStartingBalance,
    refreshWithLivePrices,
    loadingPrices,
    openTrade,
    openBatchTrades,
  } = usePaperTrading({ autoPoll: true, pollIntervalMs: 30000 });

  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar");
  const [activeTab, setActiveTab] = useState<"all" | "open" | "closed">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [importingRadar, setImportingRadar] = useState(false);
  const [batchToast, setBatchToast] = useState<string | null>(null);

  const handleImportTodaySwingRadar = async () => {
    setImportingRadar(true);
    try {
      const res = await fetch("/api/saham?grup=swing&super=0&size=50");
      if (!res.ok) throw new Error("Gagal mengambil data Radar Swing");
      const json = await res.json();
      const items: any[] = json.items || [];
      if (items.length === 0) {
        alert("Tidak ada saham radar swing yang tersedia saat ini.");
        return;
      }

      const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      const count = openBatchTrades(
        items.map((s) => {
          const isSuper = s.swing_tier === "SUPER";
          const prob = s.swing_prob ?? (isSuper ? 92 : 82);
          return {
            kode: s.kode,
            nama: s.nama,
            entryPrice: s.harga || 0,
            convictionScore: prob,
            isMsci: Boolean(s.msci || s.isMsci || isSuper),
            notes: `${isSuper ? "💎 Super Pick " : "⚡ Pilihan Utama "}${prob}% - Sinyal ${s.foreign_status || "Akumulasi Support"}`,
          };
        }),
        `Batch Swing Terkurasi ${todayStr}`
      );

      if (count > 0) {
        setBatchToast(`🎉 ${count} Saham Terkurasi (Super Picks + Pilihan Utama) hari ini (${todayStr}) berhasil dimasukkan! Posisi siap dievaluasi.`);
      } else {
        setBatchToast(`Semua saham radar swing terkurasi saat ini sudah aktif di dalam simulasi.`);
      }
      setTimeout(() => setBatchToast(null), 8000);
    } catch (e) {
      alert("Gagal mengimpor saham radar swing");
    } finally {
      setImportingRadar(false);
    }
  };

  const handleCloseBatch = (mode: "live" | "tp1" | "tp2") => {
    if (openTrades.length === 0) return;

    let confirmMsg = "";
    if (mode === "tp1") {
      confirmMsg = `Kunci profit TP 1 (+1.5%) untuk SELURUH ${openTrades.length} posisi aktif?`;
    } else if (mode === "tp2") {
      confirmMsg = `Kunci profit TP 2 (+3.0%) untuk SELURUH ${openTrades.length} posisi aktif?`;
    } else {
      confirmMsg = `Tutup SELURUH ${openTrades.length} posisi aktif pada harga live saat ini?`;
    }

    if (!window.confirm(confirmMsg)) return;

    const res = closeAllTrades(mode);
    if (res.count > 0) {
      if (mode === "tp1") {
        setBatchToast(`🎯 Sukses menutup ${res.count} posisi di Target TP 1 (+1.5%)! Total Realized Profit: +${rp(res.totalPnlRp)}.`);
      } else if (mode === "tp2") {
        setBatchToast(`🚀 Sukses menutup ${res.count} posisi di Target TP 2 (+3.0%)! Total Realized Profit: +${rp(res.totalPnlRp)}.`);
      } else {
        setBatchToast(`⚡ Sukses menutup ${res.count} posisi di harga live! Total Realized PnL: ${res.totalPnlRp >= 0 ? "+" : ""}${rp(res.totalPnlRp)}.`);
      }
      setTimeout(() => setBatchToast(null), 8000);
    }
  };

  // Form states for adding simulated trade
  const [inputKode, setInputKode] = useState("BBRI");
  const [inputNama, setInputNama] = useState("Bank Rakyat Indonesia Tbk");
  const [inputPrice, setInputPrice] = useState(4750);
  const [inputLot, setInputLot] = useState(10);
  const [inputTp1Pct, setInputTp1Pct] = useState(1.5);
  const [inputTp2Pct, setInputTp2Pct] = useState(3.0);
  const [inputSlPct, setInputSlPct] = useState(-2.0);
  const [inputScore, setInputScore] = useState(90);
  const [inputNotes, setInputNotes] = useState("Sinyal Radar Swing 90% - Akumulasi Support");

  // Form states for settings modal
  const [customBalance, setCustomBalance] = useState(summary.startingBalance);

  // Selection change helper
  const handleSelectPopular = (item: (typeof POPULAR_TICKERS)[0]) => {
    setInputKode(item.kode);
    setInputNama(item.nama);
    setInputPrice(item.defaultPrice);
  };

  const handleCreateTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKode || inputPrice <= 0 || inputLot <= 0) return;

    openTrade({
      kode: inputKode.trim().toUpperCase(),
      nama: inputNama.trim() || `${inputKode.trim().toUpperCase()} Tbk`,
      entryPrice: inputPrice,
      lot: inputLot,
      targetTp1Pct: inputTp1Pct,
      targetTp2Pct: inputTp2Pct,
      stopLossPct: inputSlPct,
      convictionScore: inputScore,
      notes: inputNotes,
    });

    setShowAddModal(false);
  };

  const calculateDuration = (startIso: string, endIso?: string) => {
    const s = new Date(startIso).getTime();
    const e = endIso ? new Date(endIso).getTime() : Date.now();
    const diffHours = Math.max(0, Math.round((e - s) / 3600000));
    if (diffHours < 24) return `${diffHours} Jam`;
    const days = Math.round(diffHours / 24);
    return `${days} Hari`;
  };

  const renderStatusBadge = (status: TradeStatus, pnlPct?: number) => {
    switch (status) {
      case "TP2_HIT":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400 bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1 text-xs font-black text-emerald-800 shadow-2xs dark:border-emerald-700 dark:from-emerald-950/60 dark:to-teal-950/60 dark:text-emerald-300">
            <span>🎯</span> TP2 HIT (+{num(pnlPct, 1)}%)
          </span>
        );
      case "TP1_HIT":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-teal-400 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 shadow-2xs dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            <span>🎯</span> TP1 HIT (+{num(pnlPct, 1)}%)
          </span>
        );
      case "SL_HIT":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 shadow-2xs dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <span>🛑</span> SL HIT ({num(pnlPct, 1)}%)
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <span>⚡</span> Manual Exit ({num(pnlPct, 1)}%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Posisi Aktif
          </span>
        );
    }
  };

  return (
    <main className="screen-shell py-6 space-y-6">
      {/* ── Top Hero Header (Satoshi Clean Style) ── */}
      <div className="crystal-intro relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#9A83FF]/15 px-3 py-1 text-xs font-bold text-[#9A83FF] backdrop-blur-md dark:bg-[#9A83FF]/25">
              <span className="text-sm">🧪</span> Laboratorium Validasi Real-Time (Tanpa Risiko)
            </div>
            <h1 className="crystal-title">
              Simulasi Paper Trading Radar Swing (1-3%)
            </h1>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-sm">
              Uji konsistensi dan akurasi analisa sinyal swing sebelum eksekusi dengan modal riil.
              Sistem secara otomatis mengevaluasi target <strong>TP1 (+1.5%)</strong>,{" "}
              <strong>TP2 (+3.0%)</strong>, dan pembatas risiko <strong>Stop Loss (-2.0%)</strong>{" "}
              mengikuti pergerakan harga live IHSG.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => refreshWithLivePrices(true)}
              disabled={loadingPrices}
              className="control-button rounded-xl border border-zinc-200 bg-white/90 py-2 text-xs font-bold text-zinc-800 shadow-2xs backdrop-blur-xl transition hover:bg-white hover:border-zinc-300 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <span className={loadingPrices ? "animate-spin" : ""}>🔄</span>
              <span>{loadingPrices ? "Mengecek..." : "Cek Harga Live"}</span>
            </button>

            <button
              onClick={handleImportTodaySwingRadar}
              disabled={importingRadar}
              className="control-button rounded-xl bg-[#191919] hover:bg-black py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60 dark:bg-white dark:text-[#191919]"
              title="Ambil seluruh saham Radar Swing Terkurasi (Super Picks + Pilihan Utama) yang lolos hari ini"
            >
              <span>🌟</span>
              <span>{importingRadar ? "Mengambil Data..." : "Ambil Saham Terkurasi Hari Ini"}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="control-button rounded-xl border border-zinc-200/80 bg-[#F8F7F7] py-2 text-xs font-bold text-[#191919] hover:bg-zinc-200/60 dark:border-white/10 dark:bg-white/[0.06] dark:text-white transition active:scale-95"
            >
              <span>+</span>
              <span>Buka Posisi Manual</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="icon-button rounded-xl border border-zinc-200 bg-white/70 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              title="Atur modal awal atau reset data"
            >
              <span>⚙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Batch Import Alert Toast ── */}
      {batchToast && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-xs font-semibold text-amber-900 shadow-sm backdrop-blur-xl dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-base">📢</span>
            <span>{batchToast}</span>
          </div>
          <button onClick={() => setBatchToast(null)} className="text-amber-700 dark:text-amber-300 font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {/* ── Metric Scorecard (Key Performance Indicators - Satoshi Style) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {/* Metric 1: Total Nilai Portofolio */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Nilai Portofolio
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-[#191919] dark:text-white tabular-nums">
            {compact(summary.portfolioValue)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold">
            <span
              className={
                summary.totalRealizedPnlRp + summary.totalUnrealizedPnlRp >= 0
                  ? "text-[#22C55E]"
                  : "text-[#FB6767]"
              }
            >
              {summary.totalRealizedPnlRp + summary.totalUnrealizedPnlRp >= 0 ? "+" : ""}
              {rp(summary.totalRealizedPnlRp + summary.totalUnrealizedPnlRp)}
            </span>
          </div>
        </div>

        {/* Metric 2: Saldo Kas Tersedia */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Kas Tersedia
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-[#191919] dark:text-white tabular-nums">
            {compact(summary.availableCash)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Dari Modal {compact(summary.startingBalance)}
          </div>
        </div>

        {/* Metric 3: Win Rate Validasi */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Win Rate Analisa
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-[#22C55E] tabular-nums">
              {summary.closedTradesCount > 0 ? `${summary.winRatePct}%` : "-"}
            </span>
            {summary.closedTradesCount > 0 && (
              <span className="text-[10px] font-bold text-zinc-400">
                ({summary.winningTrades}W / {summary.losingTrades}L)
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {summary.closedTradesCount} Selesai Terevaluasi
          </div>
        </div>

        {/* Metric 4: Realized Return */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Realized Net PnL
          </div>
          <div
            className={`mt-1 text-lg font-black tracking-tight tabular-nums ${
              summary.totalRealizedPnlRp >= 0
                ? "text-[#22C55E]"
                : "text-[#FB6767]"
            }`}
          >
            {summary.totalRealizedPnlRp >= 0 ? "+" : ""}
            {rp(summary.totalRealizedPnlRp)}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            ROI: {summary.totalRealizedPnlPct >= 0 ? "+" : ""}
            {num(summary.totalRealizedPnlPct, 2)}%
          </div>
        </div>

        {/* Metric 5: Floating Unrealized PnL */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Floating PnL
          </div>
          <div
            className={`mt-1 text-lg font-black tracking-tight tabular-nums ${
              summary.totalUnrealizedPnlRp >= 0
                ? "text-[#22C55E]"
                : "text-[#FB6767]"
            }`}
          >
            {summary.totalUnrealizedPnlRp >= 0 ? "+" : ""}
            {rp(summary.totalUnrealizedPnlRp)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {summary.openTradesCount} Posisi Aktif Berjalan
          </div>
        </div>

        {/* Metric 6: Profit Factor */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Profit Factor
          </div>
          <div className="mt-1 text-xl font-black tracking-tight text-[#22C55E] tabular-nums">
            {summary.profitFactor > 0 ? `${summary.profitFactor}x` : "-"}
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            Rasio Laba / Rugi Kotor
          </div>
        </div>
      </div>

      {/* ── Segmented Control: Kalender vs Tabel Transaksi (Satoshi Style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 pb-3 dark:border-white/10">
        <div className="grid min-w-0 grid-cols-2 gap-1 rounded-2xl bg-[#F8F7F7] p-1 backdrop-blur-xl dark:bg-white/[0.05] sm:flex sm:flex-wrap">
          <button
            type="button"
            aria-pressed={viewMode === "calendar"}
            onClick={() => setViewMode("calendar")}
            className={`control-button flex-wrap rounded-xl px-2 py-2 text-xs font-bold transition sm:px-4 ${
              viewMode === "calendar"
                ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                : "text-zinc-500 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span aria-hidden="true" className="text-sm">📅</span>
            <span>Kalender</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                viewMode === "calendar"
                  ? "bg-[#9A83FF] text-white"
                  : "bg-[#9A83FF]/15 text-[#9A83FF] dark:bg-[#9A83FF]/25 dark:text-[#9A83FF]"
              }`}
            >
              {batchPerformance.length} Batch
            </span>
          </button>

          <button
            type="button"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            className={`control-button flex-wrap rounded-xl px-2 py-2 text-xs font-bold transition sm:px-4 ${
              viewMode === "table"
                ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                : "text-zinc-500 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <span aria-hidden="true" className="text-sm">📋</span>
            <span>Transaksi</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                viewMode === "table"
                  ? "bg-[#9A83FF] text-white"
                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {trades.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/?grup=swing"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/80 bg-amber-50/70 px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 transition"
          >
            <span>⚡</span>
            <span>Buka Radar Swing (Cari Sinyal Baru)</span>
          </Link>
        </div>
      </div>

      {/* ── View 1: Calendar View ── */}
      {viewMode === "calendar" && (
        <SwingCalendar
          trades={trades}
          summary={summary}
          dailyMap={dailyPerformance}
          batchList={batchPerformance}
          onCloseBatch={handleCloseBatch}
        />
      )}

      {/* ── View 2: Table View ── */}
      {viewMode === "table" && (
        <div className="space-y-6">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 self-start rounded-2xl border border-zinc-200/80 bg-zinc-100/90 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "all"
                  ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Semua ({trades.length})
            </button>
            <button
              onClick={() => setActiveTab("open")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "open"
                  ? "bg-white text-amber-900 shadow-xs dark:bg-zinc-800 dark:text-amber-400"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              Posisi Berjalan ({openTrades.length})
            </button>
            <button
              onClick={() => setActiveTab("closed")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "closed"
                  ? "bg-white text-emerald-900 shadow-xs dark:bg-zinc-800 dark:text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Riwayat Selesai ({closedTrades.length})
            </button>
          </div>

      {/* ── Section: Active Trades (Posisi Berjalan) ── */}
      {(activeTab === "all" || activeTab === "open") && (
        <Card className="overflow-hidden border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/70">
          <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📈</span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Posisi Berjalan Real-Time ({openTrades.length})
              </h2>
              <span className="text-xs text-zinc-400 hidden sm:inline">• Evaluasi otomatis aktif</span>
            </div>

            {openTrades.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  Aksi Massal:
                </span>
                <button
                  onClick={() => handleCloseBatch("tp1")}
                  className="inline-flex items-center gap-1 rounded-xl bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition active:scale-95"
                  title="Tutup seluruh posisi aktif pada target TP 1 (+1.5%)"
                >
                  <span>🎯</span>
                  <span>Close TP 1 ({openTrades.length})</span>
                </button>
                <button
                  onClick={() => handleCloseBatch("tp2")}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition active:scale-95"
                  title="Tutup seluruh posisi aktif pada target TP 2 (+3.0%)"
                >
                  <span>🚀</span>
                  <span>Close TP 2 ({openTrades.length})</span>
                </button>
                <button
                  onClick={() => handleCloseBatch("live")}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 transition active:scale-95"
                  title="Tutup seluruh posisi aktif pada harga live saat ini"
                >
                  <span>🔴</span>
                  <span>Close All Position</span>
                </button>
              </div>
            )}
          </div>

          <div className="table-scroll">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200/60 bg-zinc-50/80 font-bold uppercase tracking-wider text-zinc-400 dark:border-white/[0.06] dark:bg-zinc-800/40 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Emiten</th>
                  <th className="px-4 py-3 text-right">Entry (Beli)</th>
                  <th className="px-4 py-3 text-right">Harga Live</th>
                  <th className="px-4 py-3 text-right">Floating PnL</th>
                  <th className="px-4 py-3 text-center">Target TP1 / TP2</th>
                  <th className="px-4 py-3 text-center">Stop Loss</th>
                  <th className="px-4 py-3 text-center">Peluang Sukses</th>
                  <th className="px-4 py-3 text-center">Aksi Tutup / TP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-white/[0.06]">
                {openTrades.map((t) => {
                  const curr = t.currentPrice ?? t.entryPrice;
                  const pnl = t.unrealizedPnlRp ?? 0;
                  const pnlPct = t.unrealizedPnlPct ?? 0;
                  const isUp = pnl >= 0;

                  // Distance calculations
                  const toTp1Pct = Number((((t.targetTp1 - curr) / curr) * 100).toFixed(1));
                  const toTp2Pct = Number((((t.targetTp2 - curr) / curr) * 100).toFixed(1));
                  const toSlPct = Number((((curr - t.stopLoss) / curr) * 100).toFixed(1));

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40 transition"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <StockLogo kode={t.kode} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/saham/${t.kode}`}
                                className="font-extrabold text-sm text-green-700 hover:underline dark:text-green-400"
                              >
                                {t.kode}
                              </Link>
                              {t.isMsci && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  MSCI
                                </span>
                              )}
                              {t.batchTag && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                  {t.batchTag}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400">
                                {calculateDuration(t.entryDate)}
                              </span>
                            </div>
                            <div className="max-w-[150px] truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {t.nama}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {rp(t.entryPrice)}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {t.lot} Lot ({compact(t.totalInvested)})
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                          <PriceFlash value={curr}>{rp(curr)}</PriceFlash>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Tertinggi: {rp(t.highestPrice)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div
                          className={`font-black text-sm ${
                            isUp
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {rp(pnl)}
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            isUp
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {num(pnlPct, 2)}%
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center tabular-nums">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              TP1: {rp(t.targetTp1)} (+{num(t.targetTp1Pct, 1)}%)
                            </span>
                            <span className="text-teal-600 dark:text-teal-400 font-bold">
                              TP2: {rp(t.targetTp2)} (+{num(t.targetTp2Pct, 1)}%)
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {curr >= t.targetTp1 ? (
                              <span className="text-emerald-600 font-bold">
                                🎯 TP1 Tercapai! (+{toTp1Pct <= 0 ? "OK" : toTp1Pct})
                              </span>
                            ) : (
                              <span>+{toTp1Pct}% menuju TP1</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center tabular-nums">
                        <div className="font-bold text-rose-600 dark:text-rose-400 text-xs">
                          {rp(t.stopLoss)} ({num(t.stopLossPct, 1)}%)
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Bantalan: +{toSlPct}% ke SL
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {t.convictionScore}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => closeTrade(t.id, t.targetTp1, "TP1_HIT")}
                            className="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition hover:bg-teal-700 active:scale-95"
                            title="Kunci profit pada target TP1 (+1.5%)"
                          >
                            Ambil TP1
                          </button>
                          <button
                            onClick={() => closeTrade(t.id, t.targetTp2, "TP2_HIT")}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition hover:bg-emerald-700 active:scale-95"
                            title="Kunci profit maksimal pada target TP2 (+3.0%)"
                          >
                            Ambil TP2
                          </button>
                          <button
                            onClick={() => closeTrade(t.id, curr, "CLOSED")}
                            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 active:scale-95"
                            title="Tutup posisi di harga live saat ini"
                          >
                            Tutup Live
                          </button>
                          <button
                            onClick={() => deleteTrade(t.id)}
                            className="text-zinc-400 hover:text-rose-500 p-1 text-xs"
                            title="Hapus simulasi"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {openTrades.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-3xl">🎯</span>
                        <div className="font-bold text-zinc-700 dark:text-zinc-300">
                          Tidak ada posisi swing yang sedang aktif
                        </div>
                        <p className="max-w-md text-xs text-zinc-500">
                          Buka Radar Swing untuk mencari saham berprobabilitas tinggi (90%+), lalu klik tombol{" "}
                          <strong>&quot;🧪 Simulasikan Buy&quot;</strong>, atau klik tombol di bawah untuk menambah manual.
                        </p>
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                        >
                          + Buka Posisi Simulasi
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Section: Closed Trades History (Riwayat Evaluasi) ── */}
      {(activeTab === "all" || activeTab === "closed") && (
        <Card className="overflow-hidden border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/70">
          <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🏆</span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Riwayat Transaksi &amp; Hasil Evaluasi ({closedTrades.length})
              </h2>
            </div>
            <div className="text-xs text-zinc-400">
              Win Rate: {summary.winRatePct}% ({summary.winningTrades} Menang / {summary.losingTrades} Kalah)
            </div>
          </div>

          <div className="table-scroll">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200/60 bg-zinc-50/80 font-bold uppercase tracking-wider text-zinc-400 dark:border-white/[0.06] dark:bg-zinc-800/40 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Emiten</th>
                  <th className="px-4 py-3">Waktu &amp; Durasi</th>
                  <th className="px-4 py-3 text-right">Beli &rarr; Jual</th>
                  <th className="px-4 py-3 text-right">Modal Investasi</th>
                  <th className="px-4 py-3 text-right">Realized Return</th>
                  <th className="px-4 py-3 text-center">Hasil Evaluasi</th>
                  <th className="px-4 py-3 text-center">Skor Sinyal</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-white/[0.06]">
                {closedTrades.map((t) => {
                  const pnl = t.realizedPnlRp ?? 0;
                  const pnlPct = t.realizedPnlPct ?? 0;
                  const isWin = pnl > 0;

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40 transition"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <StockLogo kode={t.kode} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                                {t.kode}
                              </span>
                              {t.isMsci && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  MSCI
                                </span>
                              )}
                              {t.batchTag && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                  {t.batchTag}
                                </span>
                              )}
                            </div>
                            <div className="max-w-[150px] truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {t.nama}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {calculateDuration(t.entryDate, t.exitDate)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {new Date(t.entryDate).toLocaleDateString("id-ID")} &rarr;{" "}
                          {t.exitDate ? new Date(t.exitDate).toLocaleDateString("id-ID") : "-"}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {rp(t.entryPrice)} &rarr; {rp(t.exitPrice)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {t.lot} Lot ({t.shares} Lembar)
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-zinc-700 dark:text-zinc-300">
                        {compact(t.totalInvested)}
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div
                          className={`font-black text-sm ${
                            isWin
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isWin ? "+" : ""}
                          {rp(pnl)}
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            isWin
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isWin ? "+" : ""}
                          {num(pnlPct, 2)}%
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {renderStatusBadge(t.status, pnlPct)}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {t.convictionScore}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => deleteTrade(t.id)}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800"
                          title="Hapus riwayat ini"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {closedTrades.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500"
                    >
                      Belum ada riwayat transaksi yang selesai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
        </div>
      )}

      {/* ── Educational Strategy Rationale ── */}
      <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/50">
        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
          <span>🧠</span> Logika Matematika &amp; Rahasia Sukses Swing 1-3% Per Hari
        </h3>
        <div className="mt-3 grid gap-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200/60 bg-white/70 p-4 dark:border-white/[0.05] dark:bg-zinc-800/40">
            <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              1. Mengapa Target 1.5% - 3.0%?
            </div>
            Rata-rata rentang harian (ATR) saham likuid LQ45/MSCI adalah 1.8% s/d 3.5%. Mencari profit 1-3% realistis tercapai dalam 1-3 hari bursa tanpa harus menahan volatilitas berbulan-bulan.
          </div>
          <div className="rounded-2xl border border-zinc-200/60 bg-white/70 p-4 dark:border-white/[0.05] dark:bg-zinc-800/40">
            <div className="font-bold text-teal-600 dark:text-teal-400 mb-1">
              2. Mengapa Stop Loss -2.0%?
            </div>
            Backtest membuktikan Stop Loss ketat -1.5% sering tersentuh noise transaksi kecil sebelum saham melesat naik. Batasan -2.0% s/d -2.5% memberi ruang napas ideal pada area support.
          </div>
          <div className="rounded-2xl border border-zinc-200/60 bg-white/70 p-4 dark:border-white/[0.05] dark:bg-zinc-800/40">
            <div className="font-bold text-amber-600 dark:text-amber-400 mb-1">
              3. Asimetri Risk:Reward
            </div>
            Dengan rasio Risk:Reward 1:1.5 s/d 1:2.0 dan Win Rate &gt; 65%, akun portofolio Anda secara matematis memiliki positive mathematical expectancy dan terus bertumbuh secara terukur.
          </div>
        </div>
      </div>

      {/* ── Modal: Buka Posisi Simulasi Baru ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
          <div className="ios-glass-canvas viewport-dialog relative w-full max-w-lg space-y-4 rounded-3xl p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200/70 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧪</span>
                <h3 className="font-black text-base text-[#191919] dark:text-white">
                  Buka Posisi Paper Trading
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full h-8 w-8 flex items-center justify-center border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs font-bold text-xs shrink-0 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTrade} className="mt-4 space-y-4">
              {/* Popular Ticker Quick Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Pilihan Saham Likuid:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TICKERS.slice(0, 6).map((item) => (
                    <button
                      type="button"
                      key={item.kode}
                      onClick={() => handleSelectPopular(item)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        inputKode === item.kode
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {item.kode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Kode Saham
                  </label>
                  <input
                    type="text"
                    value={inputKode}
                    onChange={(e) => setInputKode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold uppercase text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
                    placeholder="BBCA"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Harga Beli (Entry)
                  </label>
                  <input
                    type="number"
                    value={inputPrice}
                    onChange={(e) => setInputPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Jumlah Lot (1 Lot = 100 lbr)
                  </label>
                  <input
                    type="number"
                    value={inputLot}
                    onChange={(e) => setInputLot(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Total Modal Dialokasikan
                  </label>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-100/70 px-3 py-2 text-sm font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-100">
                    {rp(inputLot * 100 * inputPrice)}
                  </div>
                </div>
              </div>

              {/* Target TP & SL Inputs */}
              <div className="grid grid-cols-3 gap-2.5 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                    Target TP1 (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputTp1Pct}
                    onChange={(e) => setInputTp1Pct(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <span className="text-[10px] text-zinc-400">
                    {rp(Math.round(inputPrice * (1 + inputTp1Pct / 100)))}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-0.5">
                    Target TP2 (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputTp2Pct}
                    onChange={(e) => setInputTp2Pct(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <span className="text-[10px] text-zinc-400">
                    {rp(Math.round(inputPrice * (1 + inputTp2Pct / 100)))}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-rose-600 dark:text-rose-400 mb-0.5">
                    Stop Loss (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputSlPct}
                    onChange={(e) => setInputSlPct(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <span className="text-[10px] text-zinc-400">
                    {rp(Math.round(inputPrice * (1 + inputSlPct / 100)))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Skor Keyakinan Sinyal (60% - 95%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="60"
                    max="95"
                    value={inputScore}
                    onChange={(e) => setInputScore(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 w-12 text-right">
                    {inputScore}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Catatan Rencana Trading
                </label>
                <input
                  type="text"
                  value={inputNotes}
                  onChange={(e) => setInputNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
                  placeholder="e.g. Sinyal rebound support MA20 + Akumulasi Asing"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200/70 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-full border border-zinc-200/80 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#191919] text-white hover:bg-black dark:bg-white dark:text-[#191919] px-5 py-2 text-xs font-black shadow-md hover:scale-[1.01] active:scale-95 transition"
                >
                  Simulasikan Buy Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Settings / Modal Awal ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
          <div className="ios-glass-canvas viewport-dialog relative w-full max-w-md space-y-4 rounded-3xl p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200/70 dark:border-white/10">
              <h3 className="font-black text-base text-[#191919] dark:text-white">
                Pengaturan Simulasi
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-full h-8 w-8 flex items-center justify-center border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs font-bold text-xs shrink-0 transition"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Modal Virtual Awal (Rupiah)
                </label>
                <input
                  type="number"
                  value={customBalance}
                  onChange={(e) => setCustomBalance(Number(e.target.value))}
                  step="5000000"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
                />
                <div className="mt-2 flex gap-1.5">
                  {[10_000_000, 25_000_000, 50_000_000, 100_000_000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCustomBalance(amt)}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {compact(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    restoreDefaultSeedTrades();
                    setShowSettingsModal(false);
                  }}
                  className="w-full rounded-xl border border-teal-300 bg-teal-50/70 px-4 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
                >
                  Muat Contoh Data Terverifikasi (Seed)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Yakin ingin menghapus seluruh riwayat paper trading?")) {
                      resetTrades();
                      setShowSettingsModal(false);
                    }
                  }}
                  className="w-full rounded-xl border border-rose-300 bg-rose-50/70 px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  Reset Bersih Semua Transaksi
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200/70 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="rounded-full border border-zinc-200/80 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartingBalance(customBalance);
                    setShowSettingsModal(false);
                  }}
                  className="rounded-full bg-[#191919] text-white hover:bg-black dark:bg-white dark:text-[#191919] px-5 py-2 text-xs font-black shadow-md hover:scale-[1.01] active:scale-95 transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

