"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CryptoDetailData, CryptoItem } from "@/lib/types";
import { Card } from "./ui";
import { CoinIcon } from "./CoinIcon";
import { TradingViewChart } from "./TradingViewChart";
import { pct, rp } from "@/lib/format";
import { PriceFlash } from "./PriceFlash";

export function CryptoDetail({ symbol }: { symbol: string }) {
  const [data, setData] = useState<CryptoDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [currency, setCurrency] = useState<"IDR" | "USD">("IDR");

  // Chart view: TradingView (Binance live feed) vs Simple Line
  const [chartView, setChartView] = useState<"tradingview" | "simple">("tradingview");
  const [chartHeight, setChartHeight] = useState<number>(680);
  const [chartRange, setChartRange] = useState<"7d" | "30d" | "90d">("30d");
  const [hoveredPoint, setHoveredPoint] = useState<{ p_usd: number; p_idr: number; date: string } | null>(null);

  // Return Calculator State
  const [calcMode, setCalcMode] = useState<"dca" | "lumpsum">("dca");
  const [dcaAmount, setDcaAmount] = useState<number>(1000000); // Rp 1 Juta / bulan
  const [dcaMonths, setDcaMonths] = useState<number>(12); // 12 bulan
  const [lumpSumAmount, setLumpSumAmount] = useState<number>(10000000); // Rp 10 Juta
  const [lumpSumPeriodIdx, setLumpSumPeriodIdx] = useState<number>(2); // Default: 1 Tahun Lalu
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  const cleanSym = encodeURIComponent(symbol.trim().toLowerCase());
  useEffect(() => {
    const controller = new AbortController();
    const query = attempt > 0 ? "?refresh=1" : "";
    fetch(`/api/crypto/${cleanSym}${query}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Data koin '${symbol.toUpperCase()}' tidak ditemukan`);
        }
        return res.json();
      })
      .then((json: CryptoDetailData) => {
        if (!json || !json.symbol) {
          throw new Error("Format data cryptocurrency tidak lengkap");
        }
        if (!controller.signal.aborted) setData(json);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Gagal memuat data cryptocurrency");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, cleanSym, symbol]);

  const hasDetail = Boolean(data);
  useEffect(() => {
    if (!hasDetail) return;
    const controller = new AbortController();
    let refreshing = false;
    const interval = setInterval(() => {
      if (document.hidden || refreshing) return;
      refreshing = true;
      fetch(`/api/crypto/${cleanSym}?quote=1`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((latest: CryptoItem | null) => {
          if (latest?.symbol && !controller.signal.aborted) {
            setData((current) => current?.symbol === latest.symbol
              ? { ...current, ...latest, change_7d: current.change_7d, sparkline: current.sparkline }
              : current);
          }
        })
        .catch(() => {})
        .finally(() => { refreshing = false; });
    }, 15000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [cleanSym, hasDetail]);

  if (loading) {
    return (
      <main className="screen-shell py-16 text-center text-sm text-zinc-500">
        Memuat analisis mendalam cryptocurrency...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="screen-shell py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl dark:bg-amber-950/60 mb-3">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Data {symbol.toUpperCase()} Belum Tersedia</h1>
        <p className="mt-2 text-sm text-zinc-500">{error || "Data koin kripto ini sedang diperbarui dari jaringan Binance."}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              setAttempt((current) => current + 1);
            }}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-500"
          >
            🔄 Coba Muat Ulang
          </button>
          <Link
            href="/crypto"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            ← Kembali ke Pasar Kripto
          </Link>
        </div>
      </main>
    );
  }

  const formatPrice = (usd: number | null, idr: number | null) => {
    if (usd === null || idr === null) return "?";
    if (currency === "USD") {
      if (usd >= 1) {
        return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
    }
    if (idr >= 1000) {
      return `Rp ${idr.toLocaleString("id-ID")}`;
    }
    return `Rp ${idr.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  const formatBigNum = (usd: number | null, idr: number | null) => {
    if (usd === null || idr === null) return "?";
    if (currency === "USD") {
      if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)} Triliun`;
      if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)} Miliar`;
      if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)} Juta`;
      return `$${usd.toLocaleString("en-US")}`;
    }
    if (idr >= 1e15) return `Rp ${(idr / 1e15).toFixed(2)} Kuadriliun`;
    if (idr >= 1e12) return `Rp ${(idr / 1e12).toFixed(2)} Triliun`;
    if (idr >= 1e9) return `Rp ${(idr / 1e9).toFixed(2)} Miliar`;
    return `Rp ${idr.toLocaleString("id-ID")}`;
  };

  // Filter history points based on chartRange for Simple Chart
  const historyPoints = data.history.slice(-Number.parseInt(chartRange, 10));

  // Recommendation Badge Helper
  const getSignalBadge = (sig: NonNullable<CryptoDetailData["recommendation"]>["signal"]) => {
    switch (sig) {
      case "STRONG BUY":
        return {
          bg: "bg-emerald-500 text-white dark:bg-emerald-600",
          border: "border-emerald-600 dark:border-emerald-500",
          label: "SANGAT DISARANKAN BELI (STRONG BUY)",
        };
      case "BUY":
        return {
          bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
          border: "border-emerald-300 dark:border-emerald-800",
          label: "REKOMENDASI BELI (BUY)",
        };
      case "NEUTRAL":
        return {
          bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
          border: "border-amber-300 dark:border-amber-800",
          label: "NETRAL / WAIT AND SEE",
        };
      case "SELL":
        return {
          bg: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300",
          border: "border-rose-300 dark:border-rose-800",
          label: "REKOMENDASI JUAL (SELL)",
        };
      case "STRONG SELL":
        return {
          bg: "bg-rose-600 text-white dark:bg-rose-700",
          border: "border-rose-700 dark:border-rose-600",
          label: "SANGAT DISARANKAN JUAL (STRONG SELL)",
        };
    }
  };

  const recommendation = data.recommendation;
  const signalInfo = getSignalBadge(recommendation?.signal ?? "NEUTRAL");

  // Fear & Greed dynamic colors
  const index = recommendation?.indicators.fearGreed;
  const fgScore = index?.value ?? -1;
  const fgColorStyle =
    fgScore < 0 ? { text: "text-zinc-500", badge: "text-zinc-500" } : fgScore >= 75
      ? { text: "text-emerald-600 dark:text-emerald-400 font-black", badge: "bg-emerald-500 text-white dark:bg-emerald-600" }
      : fgScore >= 55
      ? { text: "text-emerald-600 dark:text-emerald-400 font-bold", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" }
      : fgScore >= 45
      ? { text: "text-amber-600 dark:text-amber-400 font-bold", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" }
      : fgScore >= 25
      ? { text: "text-orange-600 dark:text-orange-400 font-bold", badge: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" }
      : { text: "text-rose-600 dark:text-rose-400 font-black", badge: "bg-rose-500 text-white dark:bg-rose-600" };

  const returnSims = data.returnSimulations;
  const latestClose = data.history.at(-1);
  const totalDcaInvested = dcaAmount * dcaMonths;
  const monthlyPrices = Array.from({ length: dcaMonths }, (_, i) => {
    if (!latestClose) return null;
    const target = latestClose.t - (dcaMonths - i) * 30 * 86_400_000;
    const point = data.history.find((entry) => entry.t >= target);
    return point && point.t - target <= 3 * 86_400_000 ? point.p_idr : null;
  });
  const currentDcaValue = latestClose && monthlyPrices.every((price) => price !== null)
    ? Math.round(latestClose.p_idr * monthlyPrices.reduce<number>((units, price) => units + dcaAmount / price!, 0))
    : null;
  const dcaProfit = currentDcaValue === null ? null : currentDcaValue - totalDcaInvested;
  const dcaRoiPct = dcaProfit === null || !totalDcaInvested ? null : dcaProfit / totalDcaInvested * 100;
  const lumpSumSim = returnSims[lumpSumPeriodIdx];
  const currentLumpSumValue = lumpSumSim?.isAvailable ? Math.round(lumpSumAmount * (1 + lumpSumSim.roiPct / 100)) : null;
  const lumpSumProfit = currentLumpSumValue === null ? null : currentLumpSumValue - lumpSumAmount;

  // 24h High/Low bar calculation
  const low24 = currency === "USD" ? data.low_24h_usd : data.low_24h_idr;
  const high24 = currency === "USD" ? data.high_24h_usd : data.high_24h_idr;
  const currentP = currency === "USD" ? data.price_usd : data.price_idr;
  const rangePct = low24 !== null && high24 !== null && high24 > low24 ? Math.min(100, Math.max(0, ((currentP - low24) / (high24 - low24)) * 100)) : null;

  return (
    <main className="screen-shell space-y-8 screen-section">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/crypto"
          className="flex items-center gap-2 text-sm font-semibold text-zinc-600 transition hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          <span>←</span>
          <span>Kembali ke Pasar Kripto</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("open-ai-chat", {
                  detail: { asset: data.symbol, type: "crypto" },
                })
              );
            }}
            className="flex items-center gap-1.5 rounded-xl border border-purple-300/80 bg-purple-50/80 px-3.5 py-1.5 text-xs font-bold text-purple-900 shadow-2xs backdrop-blur-md transition hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50"
          >
            <span>🤖</span>
            <span>Tanya Analis AI</span>
          </button>

          <Link
            href={`/crypto/bandingkan?coins=${data.symbol},BTC,ETH`}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs backdrop-blur-md transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:text-emerald-400"
          >
            <span>⚖️</span>
            <span>Bandingkan {data.symbol}</span>
          </Link>

          {/* Currency Toggle */}
          <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => setCurrency("IDR")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              currency === "IDR"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Rp IDR
          </button>
          <button
            onClick={() => setCurrency("USD")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              currency === "USD"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            $ USD
          </button>
        </div>
      </div>
    </div>

      {/* Hero Header Card */}
      <Card className="crystal-hero p-6 sm:p-7 rounded-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {/* Clean Coin Icon without any text initials behind it */}
            <CoinIcon symbol={data.symbol} name={data.name} className="h-14 w-14 shadow-sm" size={56} />

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="crystal-title">
                  {data.name}
                </h1>
                <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {data.symbol}
                </span>
                {data.rank !== null && !data.stale && <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  Peringkat #{data.rank}
                </span>}
                <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {data.category}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Konsensus: {data.consensus} • Sumber kutipan: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{data.quoteSource} ({data.quoteCurrency})</span>
              </p>
            </div>
          </div>

          {/* Live Price Block */}
          <div className="flex flex-col lg:items-end">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{data.stale ? "Kutipan tersimpan" : "Kutipan penyedia"}</span>
              {data.observedAt && <time className="text-xs text-zinc-600 dark:text-zinc-400" dateTime={new Date(data.observedAt).toISOString()}>{new Date(data.observedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB</time>}
            </div>
            <div className="flex items-baseline gap-3">
              <PriceFlash value={currentP} type="hero">
                <span className="text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatPrice(data.price_usd, data.price_idr)}
                </span>
              </PriceFlash>
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                  (data.change_24h ?? 0) >= 0
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                }`}
              >
                {data.change_24h === null ? "?" : pct(data.change_24h) + " (24J)"}
              </span>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Konversi IDR memakai kurs acuan Rp15.850 per USD atau USDT.
            </span>

          </div>
        </div>

        {/* 24h High/Low Bar */}
        <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>24J Terendah: <strong className="text-zinc-900 dark:text-zinc-100">{formatPrice(data.low_24h_usd, data.low_24h_idr)}</strong></span>
            <span className="font-medium text-zinc-400">Rentang Harga Penyedia</span>
            <span>24J Tertinggi: <strong className="text-zinc-900 dark:text-zinc-100">{formatPrice(data.high_24h_usd, data.high_24h_idr)}</strong></span>
          </div>
          <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"
              style={{ width: "100%" }}
            />
            {rangePct !== null && <div
              className="absolute top-0 h-full w-2 -translate-x-1/2 rounded-full bg-zinc-950 shadow-md ring-2 ring-white dark:bg-white dark:ring-zinc-950"
              style={{ left: `${rangePct}%` }}
              title={`Posisi Saat Ini: ${rangePct.toFixed(0)}% dari rentang 24 jam`}
            />}
          </div>
        </div>
      </Card>

      {/* SECTION 1: REKOMENDASI BELI / TIDAK (QUANTITATIVE SIGNALS) */}
      {recommendation ? <Card className="p-6 sm:p-7 rounded-2xl border-emerald-500/30">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ★
              </span>
              <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Analisis Teknikal
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Skor teknikal dihitung dari harga penutupan harian Yahoo Finance.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="block text-[11px] font-medium text-zinc-400">Skor Kekuatan Sinyal</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {recommendation.score} <span className="text-xs font-normal text-zinc-400">/ 100</span>
              </span>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-center shadow-xs ${signalInfo.bg} ${signalInfo.border}`}>
              <span className="block text-xs font-bold uppercase tracking-wider">{signalInfo.label}</span>
            </div>
          </div>
        </div>

        {/* Summary Narrative */}
        <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {recommendation.summary}
        </div>

        {/* Technical Indicators Breakdown Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-[11px] font-medium text-zinc-400">RSI 14 (Relative Strength)</span>
            <p className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
              {recommendation.indicators.rsi14.value}
            </p>
            <span
              className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                recommendation.indicators.rsi14.status === "Oversold"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : recommendation.indicators.rsi14.status === "Overbought"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {recommendation.indicators.rsi14.status}
            </span>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-[11px] font-medium text-zinc-400">Tren Moving Average</span>
            <p className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
              {recommendation.indicators.maTrend.signal}
            </p>
            <span className="inline-block mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {recommendation.indicators.maTrend.aboveEma20 ? "Di atas EMA-20 ✓" : "Di bawah EMA-20 ✕"}
            </span>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-[11px] font-medium text-zinc-400">Momentum MACD</span>
            <p className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
              {recommendation.indicators.macd.signal}
            </p>
            <span className="inline-block mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {recommendation.indicators.macd.note}
            </span>
          </div>

          {/* Fear & Greed Card with dynamic colored numbers */}
          <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-[11px] font-medium text-zinc-400">Crypto Fear &amp; Greed (Global)</span>
            <p className={`mt-1.5 text-base ${fgColorStyle.text}`}>
              {recommendation.indicators.fearGreed.sentiment}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${fgColorStyle.badge}`}>
                {index?.value == null ? "?" : fgScore + "/100"}
              </span>
              <span className="text-[10px] text-zinc-400">Alternative.me</span>
            </div>
          </div>
        </div>

        {/* Pros & Risk Factors */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              ✓ Faktor Pendorong &amp; Kelebihan
            </span>
            <ul className="mt-2.5 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              {(data.recommendation?.pros ?? [
                "Likuiditas pasar terverifikasi di bursa global Binance",
                "Volume perdagangan 24 jam likuid dengan spread ketat",
                "Didukung charting TradingView interaktif",
              ]).map((p, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              ⚠ Risiko &amp; Hal yang Perlu Diwaspadai
            </span>
            <ul className="mt-2.5 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              {(data.recommendation?.risks ?? [
                "Volatilitas pasar kripto umum",
                "Sensitif terhadap pergerakan Bitcoin dan likuiditas makro global",
              ]).map((r, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card> : <Card className="p-6"><h2 className="font-bold">Analisis teknikal</h2><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Riwayat penutupan belum cukup untuk menghitung indikator.</p></Card>}

      {/* SECTION 2: CHART (TRADINGVIEW & BINANCE ADVANCED CANDLESTICK OR SIMPLE LINE) */}
      <Card className="p-6 sm:p-7 rounded-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">📊</span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Grafik Harga {data.name} ({data.symbol})
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Didukung oleh mesin chart interaktif TradingView &amp; data live spot Binance (USDT).
            </p>
          </div>

          {/* Chart Engine Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                onClick={() => setChartView("tradingview")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  chartView === "tradingview"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Candlestick (Binance Spot)
              </button>
              <button
                onClick={() => setChartView("simple")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  chartView === "simple"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Garis Sederhana
              </button>
            </div>
          </div>
        </div>

        {/* View 1: Advanced TradingView & Binance Chart */}
        {chartView === "tradingview" ? (
          <div className="mt-5">
            <TradingViewChart symbol={data.symbol} height={chartHeight} />
          </div>
        ) : (
          /* View 2: Simple Area Line Chart */
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {hoveredPoint
                    ? formatPrice(hoveredPoint.p_usd, hoveredPoint.p_idr)
                    : formatPrice(data.price_usd, data.price_idr)}
                </span>
                <span className="text-xs text-zinc-400">
                  {hoveredPoint?.date || `Rentang: ${chartRange.toUpperCase()}`}
                </span>
              </div>

              {/* Timeframe selector */}
              <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
                {(["7d", "30d", "90d"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase transition ${
                      chartRange === r
                        ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full">
              {historyPoints.length < 2 ? <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">Riwayat harga belum tersedia dari Yahoo Finance.</p> : (() => {
                const minVal = Math.min(...historyPoints.map((p) => p.p_usd));
                const maxVal = Math.max(...historyPoints.map((p) => p.p_usd));
                const range = maxVal - minVal || 1;

                const coords = historyPoints.map((pt, i) => {
                  const x = (i / (historyPoints.length - 1)) * 100;
                  const y = 92 - ((pt.p_usd - minVal) / range) * 80;
                  return { x, y, pt };
                });

                const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(" ");
                const isUp = historyPoints[historyPoints.length - 1].p_usd >= historyPoints[0].p_usd;
                const strokeColor = isUp ? "#10b981" : "#f43f5e";
                const gradientId = `grad-${data.symbol}-${chartRange}`;

                return (
                  <svg
                    className="h-full w-full overflow-visible"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <polygon fill={`url(#${gradientId})`} points={`0,100 ${pointsStr} 100,100`} />
                    <polyline
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pointsStr}
                    />

                    {coords.map((c, i) => (
                      <circle
                        key={i}
                        cx={c.x}
                        cy={c.y}
                        r="3"
                        className="cursor-pointer fill-white opacity-0 hover:opacity-100 transition stroke-2"
                        stroke={strokeColor}
                        onMouseEnter={() => {
                          const d = new Date(c.pt.t);
                          setHoveredPoint({
                            p_usd: c.pt.p_usd,
                            p_idr: c.pt.p_idr,
                            date: d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
                          });
                        }}
                      />
                    ))}
                  </svg>
                );
              })()}
            </div>
          </div>
        )}
      </Card>

      {/* SECTION 3: KALKULATOR RETURN HISTORIS (SIMULATOR INVESTASI) */}
      <Card className="p-6 sm:p-7 rounded-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                🧮
              </span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Kalkulator Return Historis &amp; Simulator Investasi
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Simulasikan hasil investasi di {data.name} berdasarkan data harga riil historis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMethodology(!showMethodology)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ℹ️ Asal Asumsi &amp; Rumus ROI {showMethodology ? "▲" : "▼"}
            </button>

            {/* Mode Switcher */}
            <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                onClick={() => setCalcMode("dca")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  calcMode === "dca"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Nabung Rutin (DCA)
              </button>
              <button
                onClick={() => setCalcMode("lumpsum")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  calcMode === "lumpsum"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Beli Sekali (Lump Sum)
              </button>
            </div>
          </div>
        </div>

        {/* Methodology Disclosure (Asumsi Return Berasal Darimana) */}
        {showMethodology && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-xs leading-relaxed text-zinc-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-zinc-300 space-y-3">
            <h4 className="font-bold text-blue-950 dark:text-blue-300 text-sm">
              📘 Metodologi &amp; Sumber Asumsi Return Investasi
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <strong className="text-zinc-900 dark:text-zinc-100">1. Sumber Data Harga Historis:</strong>
                <p>
                  Menggunakan penutupan harian Yahoo Finance. Nilai rupiah menggunakan kurs acuan tetap, dengan hasil sebelum biaya.
                </p>
              </div>
              <div className="space-y-1">
                <strong className="text-zinc-900 dark:text-zinc-100">2. Metodologi DCA (Dollar-Cost Averaging):</strong>
                <p>
                  Simulasi membeli pada penutupan pertama yang tersedia dalam tiga hari setelah setiap jadwal pembelian 30 harian. Posisi dinilai pada penutupan terakhir.
                </p>
              </div>
              <div className="space-y-1">
                <strong className="text-zinc-900 dark:text-zinc-100">3. Metodologi Lump Sum:</strong>
                <p>
                  Dihitung dari pertumbuhan modal murni: <code className="bg-white/80 px-1 py-0.5 rounded text-blue-800 dark:bg-zinc-800 dark:text-blue-300">ROI = ((Harga Sekarang - Harga Beli) / Harga Beli) × 100%</code> jika 100% modal dibelikan koin sekaligus di masa lalu.
                </p>
              </div>
              <div className="space-y-1">
                <strong className="text-zinc-900 dark:text-zinc-100">4. Catatan Kepatuhan (Disclaimer):</strong>
                <p>
                  Simulasi ini murni untuk edukasi dan proyeksi berbasis kinerja riil masa lalu (*past performance*). Kinerja masa lalu tidak menjadi jaminan hasil keuntungan di masa depan (*future performance*).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Simulator Controls & Realtime Results */}
        {calcMode === "dca" ? (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nominal Nabung Rutin (per Bulan)
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">Rp</span>
                  <input
                    type="number"
                    step={100000}
                    min={100000}
                    value={dcaAmount}
                    onChange={(e) => setDcaAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-zinc-900 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Durasi Menabung Rutin
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[6, 12, 24, 36].map((m) => (
                    <button
                      key={m}
                      onClick={() => setDcaMonths(m)}
                      className={`rounded-xl px-2 py-1.5 text-xs font-semibold transition ${
                        dcaMonths === m
                          ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500"
                          : "border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                      }`}
                    >
                      {m < 12 ? `${m} Bln` : `${m / 12} Thn`}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                *Strategi DCA (Dollar-Cost Averaging) membagi pembelian secara berkala sehingga meminimalkan risiko membeli di harga puncak.
              </p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Modal Disetor</span>
                <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Rp {totalDcaInvested.toLocaleString("id-ID")}
                </p>
                <span className="text-[11px] text-zinc-400">
                  Rp {dcaAmount.toLocaleString("id-ID")} × {dcaMonths} bulan
                </span>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-xs dark:border-emerald-950/40 dark:bg-emerald-950/20">
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Nilai pada Penutupan Terakhir</span>
                <p className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {rp(currentDcaValue)}
                </p>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  ROI {pct(dcaRoiPct)}
                </span>
              </div>

              <div className="col-span-2 rounded-xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Untung / rugi sebelum biaya</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {rp(dcaProfit)}
                  </span>
                </div>
                {currentDcaValue === null && <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Riwayat belum cukup untuk periode ini.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Modal Awal Sekali Beli
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">Rp</span>
                  <input
                    type="number"
                    step={1000000}
                    min={500000}
                    value={lumpSumAmount}
                    onChange={(e) => setLumpSumAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-zinc-900 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Waktu Pembelian di Masa Lalu
                </label>
                <div className="mt-2 space-y-1.5">
                  {returnSims.map((sim, idx) => {
                    const isAvail = sim.isAvailable !== false;
                    return (
                      <button
                        key={sim.period}
                        disabled={!isAvail}
                        onClick={() => isAvail && setLumpSumPeriodIdx(idx)}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          !isAvail
                            ? "opacity-45 cursor-not-allowed border border-dashed border-zinc-200 bg-zinc-50/60 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40"
                            : lumpSumPeriodIdx === idx
                            ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500"
                            : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span>{sim.period}</span>
                        <span>{isAvail ? pct(sim.roiPct) : (sim.note || "Belum Rilis")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-100 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Harga Beli Saat Itu</span>
                <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {rp(lumpSumSim?.isAvailable ? lumpSumSim.initialPriceIdr : null)}
                </p>
                <span className="text-[11px] text-zinc-400">
                  ≈ ${lumpSumSim.initialPriceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-xs dark:border-emerald-950/40 dark:bg-emerald-950/20">
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Nilai pada Penutupan Terakhir</span>
                <p className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {rp(currentLumpSumValue)}
                </p>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Pertumbuhan {pct(lumpSumSim?.isAvailable ? lumpSumSim.roiPct : null)}
                </span>
              </div>

              <div className="col-span-2 rounded-xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Untung / rugi sebelum biaya</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {rp(lumpSumProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Historical Return Matrix Table */}
        <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Kinerja Return Historis Multi-Periode (Disesuaikan Khusus Tiap Koin)
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {returnSims.map((s) => (
              <div
                key={s.period}
                className="rounded-xl border border-zinc-100 bg-white p-3 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="block text-[11px] font-medium text-zinc-400">{s.period}</span>
                {s.isAvailable !== false ? (
                  <span className="block mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{s.roiPct}%
                  </span>
                ) : (
                  <span className="block mt-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                    {s.note || "Belum Rilis"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* SECTION 4: STATISTIK & TOKENOMICS LENGKAP */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Tokenomics & Supply */}
        <Card className="p-6 sm:p-7 rounded-2xl">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Statistik Pasar &amp; Tokenomik
          </h3>
          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            <div className="flex items-center justify-between py-3">
              <span className="text-xs text-zinc-500">Kapitalisasi Pasar (Market Cap)</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {formatBigNum(data.market_cap_usd, data.market_cap_idr)}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-xs text-zinc-500">Volume Transaksi 24 Jam (Binance Spot)</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {formatBigNum(data.volume_24h_usd, data.volume_24h_idr)}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-xs text-zinc-500">Suplai Beredar (Circulating Supply)</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {data.circulating_supply === null ? "—" : data.circulating_supply.toLocaleString("id-ID") + " " + data.symbol}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-xs text-zinc-500">Suplai Maksimal (Max Supply)</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {data.max_supply != null ? `${data.max_supply.toLocaleString("en-US")} ${data.symbol}` : "Belum tersedia"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-xs text-zinc-500">Rasio Volume / Market Cap</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {pct(data.volume_24h_usd !== null && data.market_cap_usd ? data.volume_24h_usd / data.market_cap_usd * 100 : null)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6 sm:p-7 rounded-2xl">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Informasi Proyek</h3>
          <div className="mt-4">
            <div className="py-3">
              <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Mekanisme Konsensus &amp; Jaringan
              </span>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {data.consensus}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 5: TENTANG, HISTORI, WHITEPAPER, & LINK RESMI */}
      <Card className="p-6 sm:p-7 rounded-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">📖</span>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Tentang &amp; Sejarah {data.name} ({data.symbol})
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              {data.description}
            </p>

            {/* Milestones / Sejarah Perkembangan */}
            {data.milestones && data.milestones.length > 0 && (
              <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Lini Masa &amp; Tonggak Sejarah Penting
                </h4>
                <div className="mt-3 space-y-3">
                  {data.milestones.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40"
                    >
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {m.year}
                      </span>
                      <div>
                        <strong className="block text-xs text-zinc-900 dark:text-zinc-100">{m.title}</strong>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{m.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Official Resources & Whitepaper Links */}
          <div className="w-full lg:w-72 shrink-0 space-y-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Dokumen &amp; Tautan Resmi
            </span>

            <div className="space-y-2">
              {/* Whitepaper Button */}
              {data.whitepaper_url && (
                <a
                  href={data.whitepaper_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-emerald-300/80 bg-emerald-50/50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 shadow-2xs transition hover:bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                >
                  <span className="flex items-center gap-2">
                    <span>📄</span>
                    <span>Whitepaper / Dokumen</span>
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">PDF / Docs ↗</span>
                </a>
              )}

              {/* CoinMarketCap Button */}
              <a
                href={data.cmc_url || `https://coinmarketcap.com/currencies/${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/40 px-3.5 py-2.5 text-xs font-semibold text-blue-800 shadow-2xs transition hover:bg-blue-100/60 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                <span className="flex items-center gap-2">
                  <span>📊</span>
                  <span>CoinMarketCap Riset</span>
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">CMC ↗</span>
              </a>

              {/* Website Button */}
              {data.website_url && (
                <a
                  href={data.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 shadow-xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="flex items-center gap-2">
                    <span>🌐</span>
                    <span>Situs Web Resmi</span>
                  </span>
                  <span>↗</span>
                </a>
              )}

              {/* Blockchain Explorer Button */}
              {data.explorer_url && (
                <a
                  href={data.explorer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 shadow-xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="flex items-center gap-2">
                    <span>🔍</span>
                    <span>Block Explorer</span>
                  </span>
                  <span>↗</span>
                </a>
              )}

              {/* GitHub Button */}
              {data.github_url && (
                <a
                  href={data.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 shadow-xs transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="flex items-center gap-2">
                    <span>💻</span>
                    <span>Open Source / GitHub</span>
                  </span>
                  <span>↗</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
