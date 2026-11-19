"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Detail } from "@/lib/types";
import { compact, num, pct, rp } from "@/lib/format";
import { Card, Stat, StatusBadge } from "./ui";
import { StarButton } from "./Watchlist";
import { StockLogo } from "./StockLogo";
import { TechnicalSignals } from "./TechnicalSignals";
import { StockNewsCorporate } from "./StockNewsCorporate";
import { Financials } from "./Financials";
import { Calculator } from "./Calculator";
import { PriceFlash, LiveBadge } from "./PriceFlash";
import { BestBuyCard } from "./BestBuyCard";
import { BandarmologiCard } from "./BandarmologiCard";
import { DividendHunterCard } from "./DividendHunterCard";
import { TradingViewChart } from "./TradingViewChart";
import { MarketDepthOrderBook } from "./MarketDepthOrderBook";

const x = (v: number | null, unit = "") => (v === null ? "-" : `${num(v, 2)}${unit}`);
const compactNum = (v: number | null) => (v === null ? "-" : num(v, 0));

const REKOMENDASI: Record<string, string> = {
  strong_buy: "Strong Buy (Beli Kuat)",
  buy: "Buy (Beli)",
  hold: "Hold (Tahan)",
  underperform: "Underperform (Kurang Bagus)",
  sell: "Sell (Jual)",
};

function BarChart({ data, format }: { data: { label: string; value: number | null; sub?: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <div className="flex h-52 items-end gap-2 pt-6">
      {data.map((d) => {
        const v = d.value ?? 0;
        const h = max > 0 ? (v / max) * 100 : 0;
        return (
          <div key={d.label} className="group flex flex-1 flex-col items-center h-full justify-end">
            <div className="opacity-0 transition-opacity group-hover:opacity-100 text-center text-[10px] tabular-nums font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              {format(v)}
              {d.sub && <div className="text-emerald-600 dark:text-emerald-400">{d.sub}</div>}
            </div>
            <div className="w-full rounded-t-lg bg-emerald-600 transition-all hover:bg-emerald-500" style={{ height: `${Math.max(4, h)}%` }} />
            <span className="mt-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StockDetail({ kode }: { kode: string }) {
  const [state, setState] = useState<{ data?: Detail; error?: string }>({});
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTarget, setAlertTarget] = useState("");
  const [alertCondition, setAlertCondition] = useState<"DIATAS" | "DIBAWAH">("DIATAS");
  const [alertNote, setAlertNote] = useState("");
  const [alertStatus, setAlertStatus] = useState("");

  useEffect(() => {
    fetch(`/api/saham/${kode}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Gagal mengambil data");
        setState({ data: j });
        if (j.harga) setAlertTarget(String(Math.round(j.harga * 1.05)));
      })
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }));
  }, [kode]);

  // Seamless Background Auto-Refresh (every 12 seconds) - Live quote stream
  useEffect(() => {
    if (!kode) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/saham/${kode}?refresh=1`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: Detail | null) => {
          if (j?.kode) {
            setState((prev) =>
              prev.data
                ? {
                  data: {
                    ...prev.data,
                    harga: j.harga,
                    perubahan: j.perubahan,
                    perubahan_pct: j.perubahan_pct,
                    volume: j.volume,
                    hari_tinggi: j.hari_tinggi,
                    hari_rendah: j.hari_rendah,
                    kepemilikan: j.kepemilikan || prev.data.kepemilikan,
                    best_buy: j.best_buy || prev.data.best_buy,
                  },
                }
                : { data: j }
            );
          }
        })
        .catch(() => { });
    }, 12000);
    return () => clearInterval(interval);
  }, [kode]);

  async function saveAlert(e: React.FormEvent) {
    e.preventDefault();
    const t = Number(alertTarget);
    if (!t || t <= 0) return setAlertStatus("Target harga tidak valid");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode,
          target_harga: t,
          kondisi: alertCondition,
          catatan: alertNote,
        }),
      });
      if (res.ok) {
        setAlertStatus("✓ Alert berhasil disimpan!");
        setTimeout(() => {
          setAlertOpen(false);
          setAlertStatus("");
        }, 1500);
      } else {
        const j = await res.json();
        setAlertStatus(j.error || "Gagal menyimpan alert");
      }
    } catch {
      setAlertStatus("Gagal menyimpan alert");
    }
  }

  const back = (
    <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-green-700 dark:text-zinc-400 dark:hover:text-green-400">
      ← Kembali ke daftar saham
    </Link>
  );

  if (!state.data && !state.error) {
    return (
      <main className="screen-shell space-y-6 py-12">
        {back}
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-green-600 dark:border-zinc-800 dark:border-t-green-400" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Memuat analisis lengkap {kode}...</p>
        </Card>
      </main>
    );
  }
  if (!state.data) {
    return (
      <main className="screen-shell space-y-6 py-12">
        {back}
        <Card className="p-8 text-center text-sm text-red-600 dark:text-red-400">Gagal memuat {kode}: {state.error}</Card>
      </main>
    );
  }

  const d = state.data;
  const a = d.analisis;
  const up = (d.perubahan_pct ?? 0) >= 0;
  const w52 = d.w52_rendah !== null && d.w52_tinggi !== null && d.harga !== null && d.w52_tinggi > d.w52_rendah
    ? Math.min(100, Math.max(0, ((d.harga - d.w52_rendah) / (d.w52_tinggi - d.w52_rendah)) * 100))
    : null;

  return (
    <main className="screen-shell space-y-8 screen-section">
      {back}

      {/* Hero Header Card */}
      <Card className="crystal-hero p-4 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-1 basis-64 items-start gap-2.5 sm:gap-5">
            <StockLogo kode={d.kode} size="lg" website={d.website} className="mt-1 shadow-xs" />
            <div className="min-w-0 space-y-1.5 wrap-anywhere">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <h1 className="crystal-title">{d.kode}</h1>
                <StarButton kode={d.kode} className="text-3xl" />
                {d.sektor && (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    {d.sektor}
                  </span>
                )}
                <Link
                  href={`/bandingkan?k=${d.kode}`}
                  className="control-button rounded-full border border-zinc-200 bg-white py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Bandingkan
                </Link>
                <button
                  onClick={() => setAlertOpen(!alertOpen)}
                  className="control-button rounded-full border border-amber-300 bg-amber-50 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  🔔 Pasang Alert
                </button>
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-ai-chat", {
                        detail: { asset: d.kode, type: "stock" },
                      })
                    );
                  }}
                  className="control-button rounded-full border border-purple-300/80 bg-purple-50/80 py-1 text-xs font-bold text-purple-900 shadow-2xs transition hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50"
                >
                  🤖 Tanya Analis AI
                </button>
              </div>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-base">{d.nama}</p>
              {d.industri && <p className="text-xs text-zinc-500 dark:text-zinc-400">{d.industri}</p>}
            </div>
          </div>
          <div className="text-right sm:text-right space-y-1">
            <div className="flex flex-wrap items-center justify-end gap-2 mb-1">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300">
                🟢 Bursa BEI (IDX)
              </span>
              <LiveBadge label="Live 4s" />
            </div>
            <div>
              <PriceFlash value={d.harga} type="hero">
                <span className="text-3xl sm:text-4xl font-extrabold tabular-nums text-zinc-950 dark:text-zinc-100">
                  {rp(d.harga)}
                </span>
              </PriceFlash>
            </div>
            <div className={`text-sm font-bold tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {d.perubahan_pct === null ? "-" : `${up ? "▲" : "▼"} ${num(Math.abs(d.perubahan ?? 0), 0)} (${num(Math.abs(d.perubahan_pct), 2)}%)`}
            </div>

            {/* Quick Live Tick Simulator for Instant User Verification */}
            <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[10px]">
              <span className="text-zinc-400 dark:text-zinc-500 font-medium">⚡ Uji Flashing:</span>
              <button
                type="button"
                onClick={() => {
                  setState((prev) =>
                    prev.data
                      ? {
                        ...prev,
                        data: {
                          ...prev.data,
                          harga: Math.round((prev.data.harga ?? 1000) * 1.005),
                          perubahan_pct: Number(((prev.data.perubahan_pct ?? 0) + 0.5).toFixed(2)),
                        },
                      }
                      : prev
                  );
                }}
                className="rounded-md border border-emerald-300/80 bg-emerald-50/80 px-2 py-0.5 font-bold text-emerald-700 hover:bg-emerald-100 transition dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                title="Simulasi harga naik +0.5% untuk menguji animasi flash hijau"
              >
                +0.5% (Hijau)
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((prev) =>
                    prev.data
                      ? {
                        ...prev,
                        data: {
                          ...prev.data,
                          harga: Math.round((prev.data.harga ?? 1000) * 0.995),
                          perubahan_pct: Number(((prev.data.perubahan_pct ?? 0) - 0.5).toFixed(2)),
                        },
                      }
                      : prev
                  );
                }}
                className="rounded-md border border-rose-300/80 bg-rose-50/80 px-2 py-0.5 font-bold text-rose-700 hover:bg-rose-100 transition dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                title="Simulasi harga turun -0.5% untuk menguji animasi flash merah"
              >
                -0.5% (Merah)
              </button>
            </div>
          </div>
        </div>

        {/* Quick Price Alert Form */}
        {alertOpen && (
          <form
            onSubmit={saveAlert}
            className="mt-6 rounded-2xl border border-amber-200/90 bg-amber-50/60 p-5 transition-all dark:border-amber-900/30 dark:bg-amber-950/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/50 dark:border-amber-900/30">
              <span className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Pasang Notifikasi Alert Harga: {d.kode}
              </span>
              <button
                type="button"
                onClick={() => setAlertOpen(false)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Tutup ✕
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Kondisi Trigger
                <select
                  value={alertCondition}
                  onChange={(e) => setAlertCondition(e.target.value as "DIATAS" | "DIBAWAH")}
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="DIATAS">Harga Naik Di Atas (&ge;)</option>
                  <option value="DIBAWAH">Harga Turun Di Bawah (&le;)</option>
                </select>
              </label>

              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Target Harga (Rp)
                <input
                  type="text"
                  value={alertTarget}
                  onChange={(e) => setAlertTarget(e.target.value)}
                  placeholder="Contoh: 10500"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>

              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Catatan (opsional)
                <input
                  type="text"
                  value={alertNote}
                  onChange={(e) => setAlertNote(e.target.value)}
                  placeholder="Target profit / batas stoploss"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {alertStatus && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {alertStatus}
                </span>
              )}
              <button
                type="submit"
                className="ml-auto rounded-xl bg-green-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-green-700"
              >
                Simpan Alert
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* ── Smart Summary Hero Bar ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Live Price Tile */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_4px_16px_rgba(25,25,25,0.03)] dark:border-white/[0.08] dark:bg-[#191919]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Harga Live</span>
          <div className="mt-2">
            <PriceFlash value={d.harga} type="hero">
              <span className="text-2xl font-extrabold tabular-nums text-zinc-950 dark:text-zinc-100">{rp(d.harga)}</span>
            </PriceFlash>
            <div className={`mt-0.5 text-xs font-bold tabular-nums ${up ? "text-[#22C55E]" : "text-[#FB6767]"}`}>
              {d.perubahan_pct === null ? "-" : `${up ? "▲" : "▼"} ${num(Math.abs(d.perubahan_pct), 2)}%`}
            </div>
          </div>
        </div>

        {/* Signal Pill Tile */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_4px_16px_rgba(25,25,25,0.03)] dark:border-white/[0.08] dark:bg-[#191919]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Sinyal Teknikal</span>
          <div className="mt-2">
            <span className={`inline-flex items-center rounded-xl px-3 py-1 text-xs font-black ${a.verdict?.toLowerCase().includes("baik") || a.verdict?.toLowerCase().includes("kuat") || a.verdict?.toLowerCase().includes("buy")
              ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30"
              : a.verdict?.toLowerCase().includes("lemah") || a.verdict?.toLowerCase().includes("buruk") || a.verdict?.toLowerCase().includes("sell")
                ? "bg-[#FB6767]/10 text-[#FB6767] border border-[#FB6767]/30"
                : "bg-[#9A83FF]/10 text-[#9A83FF] border border-[#9A83FF]/30"
              }`}>
              {a.verdict ?? "Tahan"}
            </span>
            <div className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">Skor fundamental: {a.score}/100</div>
          </div>
        </div>

        {/* Best Buy Zone Tile */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_4px_16px_rgba(25,25,25,0.03)] dark:border-white/[0.08] dark:bg-[#191919]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Zona Best Buy</span>
          <div className="mt-2">
            {d.best_buy?.entryLow && d.best_buy?.entryHigh ? (
              <>
                <div className="text-sm font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {rp(d.best_buy.entryLow)} – {rp(d.best_buy.entryHigh)}
                </div>
                <div className={`mt-0.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${d.best_buy.status === "SIAP_ANTRE" ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20"
                  : d.best_buy.status === "WAIT_PULLBACK" ? "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                  {d.best_buy.status === "SIAP_ANTRE" ? "🟢 Entry Sekarang"
                    : d.best_buy.status === "WAIT_PULLBACK" ? "⏳ Tunggu Dip"
                      : d.best_buy.status === "OVERBOUGHT" ? "⚠️ Overbought"
                        : "📊 Konfirmasi"}
                </div>
              </>
            ) : (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Menghitung…</span>
            )}
          </div>
        </div>

        {/* Grade Tile */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_4px_16px_rgba(25,25,25,0.03)] dark:border-white/[0.08] dark:bg-[#191919]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Grade Fundamental</span>
          <div className="mt-2 flex items-center gap-3">
            {a.grade && (
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-extrabold text-white shadow-xs ${a.grade === "A" ? "bg-[#22C55E]"
                : a.grade === "B" ? "bg-teal-500"
                  : a.grade === "C" ? "bg-amber-500"
                    : a.grade === "D" ? "bg-orange-500"
                      : "bg-[#FB6767]"
                }`}>
                {a.grade}
              </span>
            )}
            <div>
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {a.grade === "A" ? "Sangat Kuat" : a.grade === "B" ? "Baik" : a.grade === "C" ? "Moderat" : a.grade === "D" ? "Lemah" : "Sangat Lemah"}
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {d.rekomendasi ? (d.rekomendasi === "strong_buy" ? "Strong Buy" : d.rekomendasi === "buy" ? "Buy" : d.rekomendasi === "hold" ? "Hold" : d.rekomendasi === "sell" ? "Sell" : d.rekomendasi) : "Konsensus Analis"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 1. Interactive Real-Time Chart (Positioned at Top) ── */}
      <div className="space-y-4">
        <TradingViewChart symbol={d.kode} type="stock" height={640} />

        {/* 52-Week Range Bar */}
        {w52 !== null && (
          <div className="ios-glass-canvas rounded-[24px] p-4 border border-zinc-200/80 dark:border-white/10 shadow-xs">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <span>📉</span>
                <span>52 Minggu Terendah: <strong className="text-zinc-900 dark:text-white">{rp(d.w52_rendah)}</strong></span>
              </span>
              <span className="text-[11px] font-bold text-zinc-400">Rentang Harga 1 Tahun</span>
              <span className="flex items-center gap-1.5">
                <span>📈</span>
                <span>Tertinggi: <strong className="text-zinc-900 dark:text-white">{rp(d.w52_tinggi)}</strong></span>
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-zinc-200/70 dark:bg-white/10 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                style={{ width: `${Math.max(5, Math.min(100, w52))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Market Depth & Order Book (Bid-Offer Dome) ── */}
      <MarketDepthOrderBook
        kode={d.kode}
        harga={d.harga}
        volume={d.volume}
        buka={d.buka}
        tertinggi={d.hari_tinggi}
        terendah={d.hari_rendah}
        tutup_kemarin={d.tutup_kemarin}
        onSelectPrice={(p) => {
          setAlertTarget(String(p));
          setAlertOpen(true);
        }}
      />

      {/* ── Premier Best Buy & Strategic Entry Guide (Harga Tepat Masuk) ── */}
      <BestBuyCard
        kode={d.kode}
        nama={d.nama}
        harga={d.harga}
        bestBuy={d.best_buy}
        onSetAlert={(p) => {
          setAlertTarget(String(p));
          setAlertCondition("DIBAWAH");
          setAlertOpen(true);
        }}
      />

      {/* ── Bandarmologi & Broker Flow Matrix (Fitur 1) ── */}
      <BandarmologiCard
        kode={d.kode}
        harga={d.harga}
        bandarmologi={d.bandarmologi}
      />

      {/* Fundamental Score & Verdict */}
      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div
            className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-8 border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs"
            style={{
              borderTopColor: "#16a34a",
              borderRightColor: a.score >= 25 ? "#16a34a" : undefined,
              borderBottomColor: a.score >= 50 ? "#16a34a" : undefined,
              borderLeftColor: a.score >= 75 ? "#16a34a" : undefined,
            }}
          >
            <span className="text-3xl font-extrabold text-green-700 dark:text-green-400">{a.score}</span>
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">dari 100</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-3">
              {a.grade && (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-xl font-extrabold text-white shadow-xs" title="Rating gabungan A (terbaik) - E">
                  {a.grade}
                </span>
              )}
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-zinc-100">{a.verdict}</h2>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Skor dihitung dari {a.checks.filter((c) => c.status !== "na").length} indikator yang datanya tersedia: dividen,
              profitabilitas, valuasi, pertumbuhan, utang, dan likuiditas. Ini alat bantu, bukan rekomendasi investasi.
            </p>
          </div>
        </div>

        {a.kategori?.length > 0 && (
          <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {a.kategori.map((k) => (
              <div key={k.nama} className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{k.nama}</span>
                  <span className="text-xs font-bold tabular-nums text-green-700 dark:text-green-400">{k.skor ?? "-"}</span>
                </div>
                <div className="mt-2.5 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div className="h-2 rounded-full bg-green-600" style={{ width: `${k.skor ?? 0}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{k.ringkas} · bobot {k.bobot}%</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
          {a.checks.map((c) => (
            <div key={c.label} className="flex items-start gap-3.5 rounded-xl border border-zinc-100 p-4 dark:border-zinc-800/80 dark:bg-zinc-800/30">
              <StatusBadge status={c.status} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.label}</span>
                  <span className="text-sm font-bold tabular-nums text-green-700 dark:text-green-400">{c.value}</span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Stats Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <h2 className="mb-3 font-bold text-base text-zinc-950 dark:text-zinc-100">Ringkasan Harga</h2>
          <Stat label="Buka" value={rp(d.buka)} />
          <Stat label="Penutupan kemarin" value={rp(d.tutup_kemarin)} />
          <Stat label="Rentang hari ini" value={`${num(d.hari_rendah, 0)} - ${num(d.hari_tinggi, 0)}`} />
          <Stat label="Rentang 52 minggu" value={`${num(d.w52_rendah, 0)} - ${num(d.w52_tinggi, 0)}`} />
          <Stat label="Volume" value={compactNum(d.volume)} />
          <Stat label="Volume rata-rata 3 bln" value={compactNum(d.volume_rata)} />
          <Stat label="Rata-rata 50 hari" value={rp(d.ma50)} />
          <Stat label="Rata-rata 200 hari" value={rp(d.ma200)} />
          <Stat label="Beta" value={x(d.beta)} hint="Sensitivitas terhadap pasar. Di bawah 1 berarti lebih stabil" />
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-bold text-base text-zinc-950 dark:text-zinc-100">Valuasi Fundamental</h2>
          <Stat label="Market cap" value={compact(d.mcap)} />
          <Stat label="Enterprise value" value={compact(d.ev)} />
          <Stat label="PER (trailing)" value={x(d.per, "x")} />
          <Stat label="PER (forward)" value={x(d.per_forward, "x")} />
          <Stat label="PBV" value={x(d.pbv, "x")} />
          <Stat label="PEG" value={x(d.peg)} />
          <Stat label="Price / Sales" value={x(d.ps, "x")} />
          <Stat label="EV / Revenue" value={x(d.ev_revenue, "x")} />
          <Stat label="EPS" value={rp(d.eps)} />
          <Stat label="Nilai buku per saham" value={rp(d.bvps)} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-bold text-base text-zinc-950 dark:text-zinc-100">Profitabilitas &amp; Pertumbuhan</h2>
          <Stat label="ROE" value={pct(d.roe_pct)} />
          <Stat label="ROA" value={pct(d.roa_pct)} />
          <Stat label="Margin laba bersih" value={pct(d.margin_laba_pct)} />
          <Stat label="Margin operasi" value={pct(d.margin_operasi_pct)} />
          <Stat label="Margin kotor" value={pct(d.margin_kotor_pct)} />
          <Stat label="Pertumbuhan pendapatan" value={pct(d.pertumbuhan_pendapatan_pct)} />
          <Stat label="Pertumbuhan laba" value={pct(d.pertumbuhan_laba_pct)} />
          <Stat label="Pertumbuhan laba kuartalan" value={pct(d.pertumbuhan_laba_kuartal_pct)} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-bold text-base text-zinc-950 dark:text-zinc-100">Kesehatan Keuangan</h2>
          <Stat label="Pendapatan (12 bln)" value={compact(d.pendapatan)} />
          <Stat label="Kas &amp; Setara Kas" value={compact(d.kas)} />
          <Stat label="Total Utang" value={compact(d.utang)} />
          <Stat label="Debt to equity (DER)" value={x(d.der, "%")} />
          <Stat label="Current ratio" value={x(d.current_ratio)} />
          <Stat label="Arus kas operasi" value={compact(d.arus_kas_operasi)} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-bold text-base text-zinc-950 dark:text-zinc-100">Dividen</h2>
          <Stat label="Dividend yield" value={pct(d.yield_pct)} />
          <Stat label="DPS 12 bulan" value={rp(d.dps_12m)} />
          <Stat label="Payout ratio" value={pct(d.payout_pct, 1)} />
          <Stat label="Tahun berturut-turut" value={`${d.tahun_berturut} tahun`} />
          <Stat label="CAGR DPS 5 tahun" value={pct(d.cagr_dps_pct)} />
          <Stat label="Ex-dividend date" value={d.ex_date ? new Date(d.ex_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-bold text-base text-zinc-950 dark:text-zinc-100">Konsensus Analis</h2>
          <Stat label="Rekomendasi" value={d.rekomendasi ? (REKOMENDASI[d.rekomendasi] ?? d.rekomendasi) : "-"} />
          <Stat label="Jumlah analis" value={d.jumlah_analis ?? "-"} />
          <Stat label="Target rata-rata" value={rp(d.target_rata)} />
          <Stat label="Target tertinggi" value={rp(d.target_tinggi)} />
          <Stat label="Target terendah" value={rp(d.target_rendah)} />
          <Stat label="Saham beredar" value={compactNum(d.saham_beredar)} />
          <Stat label="Float" value={compactNum(d.float_saham)} />
          <Stat label="Dimiliki insider" value={pct(d.insider_pct, 1)} />
          <Stat label="Dimiliki institusi" value={pct(d.institusi_pct, 1)} />
        </Card>
      </div>

      {/* ── Dividend Hunter & Trap Protector Matrix (Fitur 4) ── */}
      <DividendHunterCard
        kode={d.kode}
        harga={d.harga}
        dividendData={d.dividend_trap}
      />

      {/* Dividen Bar Chart */}
      <Card className="p-6 sm:p-7">
        <h2 className="mb-1 text-lg font-bold text-zinc-950 dark:text-zinc-100">Dividen per Saham per Tahun (10 Tahun Terakhir)</h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Angka dividen per lembar saham (DPS) dan estimasi yield berdasarkan harga penutupan akhir tahun.
        </p>
        <BarChart
          data={d.dividen_tahunan.slice(-10).map((y) => ({
            label: String(y.tahun),
            value: y.dps,
            sub: y.yield_pct === null ? undefined : `${num(y.yield_pct, 2)}%`,
          }))}
          format={(v) => `Rp ${num(v, 0)}`}
        />
      </Card>

      {/* Laporan Keuangan */}
      <Financials kode={d.kode} />

      {/* Kepemilikan & Orderbook */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 sm:p-7">
          <h2 className="mb-1 text-lg font-bold text-zinc-950 dark:text-zinc-100">Struktur Kepemilikan Saham</h2>
          <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
            Komposisi kepemilikan saham dari data publik.
          </p>
          <Stat label="Dimiliki insider / manajemen" value={pct(d.kepemilikan.insider_pct, 1)} />
          <Stat label="Dimiliki institusi" value={pct(d.kepemilikan.institusi_pct, 1)} />
          <Stat label="Institusi dari float" value={pct(d.kepemilikan.institusi_float_pct, 1)} />
          <Stat label="Jumlah institusi" value={compactNum(d.kepemilikan.jumlah_institusi)} />
          {d.kepemilikan.dana.length > 0 && (
            <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pemegang Saham / Reksa Dana Terbesar</h3>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                {d.kepemilikan.dana.map((h) => (
                  <li key={h.nama} className="flex justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300" title={h.nama}>{h.nama}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {h.pct === null ? "-" : `${num(h.pct, 2)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="p-6 sm:p-7">
          <h2 className="mb-1 text-lg font-bold text-zinc-950 dark:text-zinc-100">Orderbook &amp; Referensi Broker</h2>
          <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
            Penawaran terbaik (best bid/offer).
          </p>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Best Bid (Beli)</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">{d.kepemilikan.bid ? rp(d.kepemilikan.bid) : "-"}</div>
              <div className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">Antrean: {compactNum(d.kepemilikan.bid_size)} lot</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Best Offer (Jual)</div>
              <div className="mt-1 text-2xl font-extrabold text-zinc-800 dark:text-zinc-200">{d.kepemilikan.ask ? rp(d.kepemilikan.ask) : "-"}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Antrean: {compactNum(d.kepemilikan.ask_size)} lot</div>
            </div>
          </div>
          <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Orderbook 10 level mendalam dan running trade real-time streaming memerlukan koneksi langsung ke broker / BEI.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5 text-xs">
            <a href={`https://stockbit.com/symbol/${d.kode}`} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              Buka di Stockbit ↗
            </a>
            <a href={`https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/`} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              Profil Resmi IDX ↗
            </a>
          </div>
        </Card>
      </div>

      {/* Technical Indicators summary */}
      <TechnicalSignals
        riwayat={d.riwayat_harga ?? []}
        harga={d.harga}
        kode={d.kode}
      />

      {/* DRIP Calculator */}
      <Calculator kode={d.kode} harga={d.harga} yieldPct={d.yield_pct} />

      {/* News & Corporate actions */}
      <StockNewsCorporate
        kode={d.kode}
        berita={d.berita}
        splits={d.splits}
        corporateActions={d.corporate_actions}
      />
    </main>
  );
}
