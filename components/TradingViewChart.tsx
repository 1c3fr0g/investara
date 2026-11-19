"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { LiveCandlestickChart } from "./LiveCandlestickChart";

export type ChartTimeframe = "1" | "5" | "15" | "60" | "D" | "W";
export type ChartHeightPreset = 520 | 640 | 780;

interface LiveQuoteData {
  price: number | null;
  change: number | null;
  changePct: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
}

interface TradingViewChartProps {
  symbol: string;
  type?: "stock" | "crypto";
  theme?: "dark" | "light";
  height?: number;
  defaultInterval?: ChartTimeframe;
  showTimeframeBar?: boolean;
}

function getIdxMarketStatus(): {
  label: string;
  isOpen: boolean;
  color: string;
  subtext: string;
  nextOpen: string;
} {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600000);
  const day = wib.getDay();
  const hour = wib.getHours();
  const min = wib.getMinutes();
  const totalMin = hour * 60 + min;

  if (day === 0 || day === 6) {
    return {
      label: "Pasar Libur (Akhir Pekan)",
      isOpen: false,
      color: "text-zinc-400",
      subtext: "Bursa Efek Indonesia libur akhir pekan",
      nextOpen: "Senin 09:00 WIB",
    };
  }

  const isFriday = day === 5;
  const session1End = isFriday ? 11 * 60 + 30 : 12 * 60;
  const session2Start = isFriday ? 14 * 60 : 13 * 60 + 30;

  if (totalMin >= 8 * 60 + 45 && totalMin < 8 * 60 + 59) {
    return {
      label: "Pra-Pembukaan (08:45-08:59 WIB)",
      isOpen: true,
      color: "text-amber-500",
      subtext: "Sesi pra-pembukaan bursa berlangsung",
      nextOpen: "Sesi I 09:00 WIB",
    };
  }
  if (totalMin >= 9 * 60 && totalMin < session1End) {
    return {
      label: "Sesi I Aktif",
      isOpen: true,
      color: "text-emerald-500",
      subtext: "Pasar sedang berlangsung secara live",
      nextOpen: `Istirahat ${isFriday ? "11:30" : "12:00"} WIB`,
    };
  }
  if (totalMin >= session1End && totalMin < session2Start) {
    return {
      label: "Istirahat Siang",
      isOpen: false,
      color: "text-amber-500",
      subtext: "Perdagangan sesi I selesai, rehat siang",
      nextOpen: `Sesi II ${isFriday ? "14:00" : "13:30"} WIB`,
    };
  }
  if (totalMin >= session2Start && totalMin < 15 * 60 + 49) {
    return {
      label: "Sesi II Aktif",
      isOpen: true,
      color: "text-emerald-500",
      subtext: "Pasar sedang berlangsung secara live",
      nextOpen: "Pra-Penutupan 15:50 WIB",
    };
  }
  if (totalMin >= 15 * 60 + 50 && totalMin <= 16 * 60) {
    return {
      label: "Pra-Penutupan (15:50-16:00 WIB)",
      isOpen: true,
      color: "text-amber-500",
      subtext: "Pembentukan harga penutupan resmi",
      nextOpen: "Pasar Tutup 16:15 WIB",
    };
  }
  if (totalMin > 16 * 60 && totalMin <= 16 * 60 + 15) {
    return {
      label: "Pasca-Penutupan (16:05-16:15 WIB)",
      isOpen: false,
      color: "text-amber-500",
      subtext: "Transaksi crossing akhir hari",
      nextOpen: isFriday ? "Senin 09:00 WIB" : "Besok 09:00 WIB",
    };
  }

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const nextDayName = isFriday ? "Senin" : days[(day + 1) % 7];
  const nextOpenStr = totalMin < 8 * 60 + 45 ? "Hari ini 09:00 WIB" : `${nextDayName} 09:00 WIB`;

  return {
    label: "Pasar Tutup",
    isOpen: false,
    color: "text-zinc-400",
    subtext: "Perdagangan BEI hari ini telah berakhir",
    nextOpen: nextOpenStr,
  };
}

export function TradingViewChart({
  symbol,
  type = "stock",
  theme,
  height = 640,
  defaultInterval = "15",
  showTimeframeBar = true,
}: TradingViewChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>(defaultInterval);
  const [currentHeight, setCurrentHeight] = useState<number>(height >= 500 ? height : 640);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartEngine, setChartEngine] = useState<"live" | "tradingview">(type === "stock" ? "live" : "tradingview");

  const idxStatus =
    type === "stock"
      ? getIdxMarketStatus()
      : {
          label: "Pasar 24/7 Live",
          isOpen: true,
          color: "text-emerald-500",
          subtext: "Pasar kripto beroperasi tanpa henti 24 jam sehari, 7 hari seminggu",
          nextOpen: "24/7",
        };

  // Live Quote Streaming State
  const [liveQuote, setLiveQuote] = useState<LiveQuoteData>({
    price: null,
    change: null,
    changePct: null,
    bid: null,
    ask: null,
    volume: null,
    high: null,
    low: null,
  });
  const [tickDirection, setTickDirection] = useState<"up" | "down" | null>(null);
  const [lastUpdatedSec, setLastUpdatedSec] = useState<number>(0);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(10); // seconds (0 = paused)

  // Clean raw symbol
  const cleanSymbol = symbol
    .toUpperCase()
    .trim()
    .replace(/^IDX:/i, "")
    .replace(/^BINANCE:/i, "")
    .replace(/USDT$/i, "");

  // Sync if prop height changes
  useEffect(() => {
    if (height && height >= 500) {
      setCurrentHeight(height);
    }
  }, [height]);

  // Listen to browser fullscreen changes (e.g. user presses ESC)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  // Normalize symbol for TradingView
  const rawSymbol = symbol.toUpperCase().trim();
  const tvSymbol =
    type === "crypto"
      ? rawSymbol.startsWith("BINANCE:")
        ? rawSymbol
        : `BINANCE:${rawSymbol.replace(/USDT$/, "")}USDT`
      : rawSymbol.startsWith("IDX:")
      ? rawSymbol
      : `IDX:${rawSymbol}`;

  // Dynamically detect dark or light theme from html class
  const [activeTheme, setActiveTheme] = useState<"dark" | "light">(theme || "light");

  useEffect(() => {
    if (theme) {
      setActiveTheme(theme);
      return;
    }
    if (typeof document !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      setActiveTheme(isDark ? "dark" : "light");

      const observer = new MutationObserver(() => {
        const dark = document.documentElement.classList.contains("dark");
        setActiveTheme(dark ? "dark" : "light");
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }
  }, [theme]);

  // Live polling fetcher
  const fetchLiveQuote = useCallback(async () => {
    if (!cleanSymbol) return;
    setIsFetching(true);
    try {
      const endpoint =
        type === "crypto"
          ? `/api/crypto/${cleanSymbol}?refresh=1`
          : `/api/saham/${cleanSymbol}?refresh=1`;

      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();

      if (type === "stock" && typeof data.harga === "number") {
        setLiveQuote((prev) => {
          if (prev.price !== null && data.harga !== prev.price) {
            setTickDirection(data.harga > prev.price ? "up" : "down");
            setTimeout(() => setTickDirection(null), 1400);
          }
          return {
            price: data.harga,
            change: data.perubahan ?? null,
            changePct: data.perubahan_pct ?? null,
            bid: data.order_book?.bid ?? null,
            ask: data.order_book?.ask ?? null,
            volume: data.volume ?? null,
            high: data.hari_tinggi ?? null,
            low: data.hari_rendah ?? null,
          };
        });
        setLastUpdatedSec(0);
      } else if (type === "crypto" && typeof data.p_usd === "number") {
        setLiveQuote((prev) => {
          if (prev.price !== null && data.p_usd !== prev.price) {
            setTickDirection(data.p_usd > prev.price ? "up" : "down");
            setTimeout(() => setTickDirection(null), 1400);
          }
          return {
            price: data.p_usd,
            change: null,
            changePct: data.chg_24h ?? null,
            bid: null,
            ask: null,
            volume: data.volume_24h_usd ?? null,
            high: data.high_24h ?? null,
            low: data.low_24h ?? null,
          };
        });
        setLastUpdatedSec(0);
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setIsFetching(false);
    }
  }, [cleanSymbol, type]);

  // Initial fetch and auto-refresh loop
  useEffect(() => {
    fetchLiveQuote();
  }, [fetchLiveQuote]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const intervalSec = !idxStatus.isOpen && type === "stock" ? Math.max(refreshInterval, 60) : refreshInterval;
    const timer = setInterval(() => {
      if (!document.hidden) {
        fetchLiveQuote();
      }
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [fetchLiveQuote, refreshInterval, idxStatus.isOpen, type]);

  // Seconds counter for "Updated X sec ago"
  useEffect(() => {
    const secTimer = setInterval(() => {
      setLastUpdatedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(secTimer);
  }, []);

  const effectiveHeight = isFullscreen ? "calc(100vh - 120px)" : `${currentHeight}px`;

  // Mount TradingView Widget when symbol, interval, theme, height, or engine changes
  useEffect(() => {
    if (chartEngine !== "tradingview") return;
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.cssText = `width: 100%; height: ${effectiveHeight}; min-height: ${effectiveHeight}; display: block; position: relative;`;
    container.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Official TradingView Advanced Real-Time Chart Configuration
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: isFullscreen ? "100%" : currentHeight,
      autosize: isFullscreen,
      symbol: tvSymbol,
      interval: timeframe,
      timezone: "Asia/Jakarta",
      theme: activeTheme === "dark" ? "dark" : "light",
      style: "1", // Candlesticks
      locale: "id",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      withdateranges: true,
      save_image: true,
      details: false,
      hotlist: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = "";
    };
  }, [tvSymbol, timeframe, activeTheme, currentHeight, isFullscreen, chartEngine, effectiveHeight]);

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden transition-all duration-200 flex flex-col ${
        isFullscreen
          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-white dark:bg-[#191919] p-3"
          : "ios-glass-canvas rounded-[32px] border border-zinc-200/80 shadow-2xl dark:border-white/10"
      }`}
    >
      {/* ── BAR 1: Live Real-Time Ticker & Market Streaming Pulse ── */}
      {showTimeframeBar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/60 px-5 py-2.5 bg-zinc-50/60 dark:bg-white/[0.02] dark:border-white/5">
          {/* Left: Streaming Badge, Market Session, and Live Price */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            {/* Live / Market Status Indicator Dot */}
            {idxStatus.isOpen ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]"></span>
                </span>
                <span className="text-[10px] font-black tracking-wide text-emerald-600 dark:text-emerald-400">
                  {type === "crypto" ? "LIVE BINANCE SPOT" : "FEED BEI (DELAY ~15 MNT)"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-200/80 dark:bg-white/10 px-2.5 py-0.5 border border-zinc-300 dark:border-white/15">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-400"></span>
                </span>
                <span className="text-[10px] font-black tracking-wide text-zinc-600 dark:text-zinc-300">
                  PASAR TUTUP (OFFLINE)
                </span>
              </div>
            )}

            {/* Session Indicator */}
            <span className={`text-[11px] font-bold ${idxStatus.color} flex items-center gap-1`}>
              <span>{idxStatus.isOpen ? "⏱" : "🌙"}</span>
              <span>{idxStatus.label}</span>
              {!idxStatus.isOpen && type === "stock" && (
                <span className="hidden lg:inline font-medium text-zinc-400 dark:text-zinc-500 text-[10px]">
                  · Buka {idxStatus.nextOpen}
                </span>
              )}
            </span>

            {/* Delay Notice Pill (shown when market is active) */}
            {type === "stock" && idxStatus.isOpen && (
              <span
                className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400"
                title="Sesuai regulasi resmi bursa BEI, feed data candlestick publik mengalami penundaan (delay) 10-15 menit"
              >
                <span>⏱</span>
                <span>Data Delay ~10-15 Mnt (Aturan Bursa)</span>
              </span>
            )}

            {/* Live Last Price with Tick Flash */}
            {liveQuote.price !== null && (
              <div
                className={`flex items-center gap-2 rounded-lg px-2 py-0.5 transition-all duration-300 ${
                  tickDirection === "up"
                    ? "flash-up bg-emerald-500/15"
                    : tickDirection === "down"
                    ? "flash-down bg-rose-500/15"
                    : "bg-transparent"
                }`}
              >
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {type === "crypto"
                    ? `$${liveQuote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                    : `Rp ${liveQuote.price.toLocaleString("id-ID")}`}
                </span>
                {!idxStatus.isOpen && type === "stock" && (
                  <span className="rounded bg-zinc-200/70 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 dark:text-zinc-400">
                    Close
                  </span>
                )}

                {liveQuote.changePct !== null && (
                  <span
                    className={`text-xs font-bold tabular-nums flex items-center ${
                      liveQuote.changePct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-[#FB6767]"
                    }`}
                  >
                    <span>{liveQuote.changePct >= 0 ? "▲" : "▼"}</span>
                    <span>
                      {liveQuote.change !== null && type === "stock"
                        ? ` ${liveQuote.change > 0 ? "+" : ""}${liveQuote.change} (`
                        : " "}
                      {liveQuote.changePct > 0 ? "+" : ""}
                      {liveQuote.changePct.toFixed(2)}%
                      {liveQuote.change !== null && type === "stock" ? ")" : ""}
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* Bid & Ask Spread (For Stocks) */}
            {liveQuote.bid !== null && liveQuote.ask !== null && (
              <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <span className="text-emerald-600 dark:text-emerald-400">Bid: {liveQuote.bid.toLocaleString("id-ID")}</span>
                <span className="text-zinc-300 dark:text-zinc-600">/</span>
                <span className="text-rose-500">Ask: {liveQuote.ask.toLocaleString("id-ID")}</span>
              </div>
            )}
          </div>

          {/* Right: Refresh Rate Control & Instant Refresh Button */}
          <div className="flex items-center gap-2 text-xs">
            {/* Auto-Refresh Speed Selector */}
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-zinc-400">
              <span>Auto:</span>
              <button
                type="button"
                onClick={() => setRefreshInterval(5)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                  refreshInterval === 5
                    ? "bg-zinc-800 text-white dark:bg-white dark:text-zinc-900"
                    : "hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
                title="Refresh setiap 5 detik"
              >
                5s
              </button>
              <button
                type="button"
                onClick={() => setRefreshInterval(10)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                  refreshInterval === 10
                    ? "bg-zinc-800 text-white dark:bg-white dark:text-zinc-900"
                    : "hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
                title="Refresh setiap 10 detik"
              >
                10s
              </button>
              <button
                type="button"
                onClick={() => setRefreshInterval(30)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                  refreshInterval === 30
                    ? "bg-zinc-800 text-white dark:bg-white dark:text-zinc-900"
                    : "hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
                title="Refresh setiap 30 detik"
              >
                30s
              </button>
              <button
                type="button"
                onClick={() => setRefreshInterval(0)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                  refreshInterval === 0
                    ? "bg-amber-500 text-white"
                    : "hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
                title="Jeda pembaruan otomatis"
              >
                Jeda
              </button>
            </div>

            {/* Last updated relative time */}
            <span className="text-[10px] text-zinc-400 font-medium">
              {lastUpdatedSec <= 1 ? "Baru saja" : `${lastUpdatedSec}s lalu`}
            </span>

            {/* Instant Manual Refresh Button */}
            <button
              type="button"
              onClick={fetchLiveQuote}
              disabled={isFetching}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 transition shadow-2xs disabled:opacity-50"
              title="Perbarui data quote live sekarang"
            >
              <span className={`inline-block ${isFetching ? "animate-spin" : ""}`}>↻</span>
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>
      )}

      {/* ── BAR 2: Engine Switcher, Timeframe Quick Switcher & Height Controls ── */}
      {showTimeframeBar && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-200/70 px-5 py-2.5 dark:border-white/10">
          {/* Left: Chart Engine (BEI Live vs TradingView) & Timeframe Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Chart Engine Switcher: BEI Live vs TradingView */}
            {type === "stock" && (
              <div className="flex items-center gap-1 rounded-full ios-glass-subtle p-0.5">
                <button
                  type="button"
                  onClick={() => setChartEngine("live")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                    chartEngine === "live"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="Candlestick BEI dengan Volume & MA20 (Delay ~10-15 menit sesuai feed bursa)"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                  </span>
                  <span>⚡ Candlestick BEI (Delay 15m)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartEngine("tradingview")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                    chartEngine === "tradingview"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="TradingView Pro Chart (Delayed 15m by exchange policy)"
                >
                  <span>📊 TradingView (Delay 15m)</span>
                </button>
              </div>
            )}

            {/* TradingView Timeframe Pills (Only shown when TradingView is active) */}
            {chartEngine === "tradingview" && (
              <div className="flex items-center gap-1 rounded-full ios-glass-subtle p-0.5">
                <span className="text-[10px] font-bold text-zinc-400 pl-2 pr-0.5">TF:</span>
                <button
                  type="button"
                  onClick={() => setTimeframe("1")}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition ${
                    timeframe === "1"
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="1 Menit"
                >
                  1M
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe("5")}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition ${
                    timeframe === "5"
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="5 Menit"
                >
                  5M
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe("15")}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition ${
                    timeframe === "15"
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="15 Menit"
                >
                  15M
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe("60")}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition ${
                    timeframe === "60"
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="1 Jam"
                >
                  1H
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe("D")}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition ${
                    timeframe === "D"
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="Harian (Daily)"
                >
                  1D
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe("W")}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition ${
                    timeframe === "W"
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="Mingguan"
                >
                  1W
                </button>
              </div>
            )}
          </div>

          {/* Right: Height Controls, Native Fullscreen, and External Link */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Height Switcher (Only visible when not in fullscreen) */}
            {!isFullscreen && (
              <div className="hidden sm:flex items-center gap-1 rounded-full ios-glass-subtle p-0.5">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 pl-2 pr-0.5">Tinggi:</span>
                <button
                  type="button"
                  onClick={() => setCurrentHeight(520)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                    currentHeight === 520
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="Tinggi 520px (Kompak)"
                >
                  520px
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentHeight(640)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                    currentHeight === 640
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="Tinggi 640px (Ideal)"
                >
                  640px (Ideal)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentHeight(780)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                    currentHeight === 780
                      ? "bg-[#191919] text-white shadow-xs dark:bg-white dark:text-[#191919]"
                      : "text-zinc-600 hover:text-[#191919] dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  title="Tinggi 780px (Ekspansif / Desktop Pro)"
                >
                  780px
                </button>
              </div>
            )}

            {/* Native Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition shadow-2xs ${
                isFullscreen
                  ? "border-[#FB6767] bg-[#FB6767]/10 text-[#FB6767] hover:bg-[#FB6767]/20"
                  : "border-zinc-200/80 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
              title={isFullscreen ? "Keluar dari Layar Penuh (ESC)" : "Perbesar Grafik ke Layar Penuh Monitor"}
            >
              <span>{isFullscreen ? "✕ Keluar Layar Penuh (ESC)" : "⛶ Layar Penuh"}</span>
            </button>

            {/* External TradingView Link */}
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 transition shadow-2xs"
              title="Buka chart lengkap di tradingview.com"
            >
              <span>TradingView</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      )}

      {/* ── MARKET CLOSED NOTICE BANNER (Displayed prominently when market is closed) ── */}
      {!idxStatus.isOpen && type === "stock" && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-zinc-100/90 dark:bg-white/[0.03] border-b border-zinc-200/70 dark:border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-zinc-400 shrink-0" />
            <span className="font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>🌙</span>
              <span>{idxStatus.label}:</span>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              {idxStatus.subtext}. Grafik menampilkan <strong>harga penutupan resmi (Closing Price)</strong>. Buka kembali <strong>{idxStatus.nextOpen}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-zinc-200/80 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
              Closing Data
            </span>
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              Delay 15m
            </span>
          </div>
        </div>
      )}

      {/* Engine 1: Native Real-Time Live Candlestick & Volume Chart */}
      {chartEngine === "live" && (
        <LiveCandlestickChart
          symbol={cleanSymbol}
          height={currentHeight}
          livePrice={liveQuote.price}
          theme={activeTheme}
          isMarketOpen={idxStatus.isOpen}
          marketStatusLabel={idxStatus.label}
          marketNextOpen={idxStatus.nextOpen}
        />
      )}

      {/* TradingView Delay Notice Banner */}
      {chartEngine === "tradingview" && type === "stock" && (
        <div className="flex items-center justify-between gap-2 px-5 py-2 bg-amber-500/[0.08] border-b border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span>⏱</span>
            <span>
              <strong>Pemberitahuan Delay:</strong> Sesuai regulasi Bursa Efek Indonesia (BEI), grafik TradingView publik mengalami <strong>delay 15 menit</strong>. Jam candle mencerminkan data historis tertunda.
            </span>
          </span>
          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
            Delay 15 Menit
          </span>
        </div>
      )}

      {/* Engine 2: TradingView Advanced Chart Widget */}
      {chartEngine === "tradingview" && (
        <div
          ref={containerRef}
          className="tradingview-widget-container relative w-full overflow-hidden"
          style={{
            width: "100%",
            height: effectiveHeight,
            minHeight: effectiveHeight,
          }}
        />
      )}
    </div>
  );
}
