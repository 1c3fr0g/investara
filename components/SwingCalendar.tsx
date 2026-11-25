"use client";

import { useState, useMemo } from "react";
import type {
  PaperTrade,
  PaperTradingSummary,
  DailyPerformance,
  BatchPerformance,
} from "@/lib/paperTrading";
import { num, rp, compact } from "@/lib/format";
import { StockLogo } from "./StockLogo";
import Link from "next/link";
import { Card } from "./ui";

interface SwingCalendarProps {
  trades: PaperTrade[];
  summary: PaperTradingSummary;
  dailyMap: Record<string, DailyPerformance>;
  batchList: BatchPerformance[];
  onCloseBatch?: () => void;
}

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_NAMES_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function SwingCalendar({
  trades,
  summary,
  dailyMap,
  batchList,
  onCloseBatch,
}: SwingCalendarProps) {
  // Determine initial year and month from latest trade or current date
  const initialDate = useMemo(() => {
    if (trades.length > 0) {
      const dates = trades
        .map((t) => t.exitDate || t.entryDate)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        const latest = new Date(dates[dates.length - 1]);
        if (!isNaN(latest.getTime())) return latest;
      }
    }
    return new Date();
  }, [trades]);

  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Selected date for drill-down
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const datesWithData = Object.keys(dailyMap).sort();
    return datesWithData.length > 0 ? datesWithData[datesWithData.length - 1] : null;
  });

  // Calculate calendar grid for current month
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const totalDays = lastDayOfMonth.getDate();

    // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    // We want Monday = 0, ... Sunday = 6
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      data?: DailyPerformance;
    }> = [];

    // Padding for days before the 1st
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        dayNumber: 0,
        dateStr: "",
        isCurrentMonth: false,
        isWeekend: false,
      });
    }

    // Days in current month
    for (let day = 1; day <= totalDays; day++) {
      const mStr = String(currentMonth + 1).padStart(2, "0");
      const dStr = String(day).padStart(2, "0");
      const dateStr = `${currentYear}-${mStr}-${dStr}`;

      const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      days.push({
        dayNumber: day,
        dateStr,
        isCurrentMonth: true,
        isWeekend,
        data: dailyMap[dateStr],
      });
    }

    return days;
  }, [currentYear, currentMonth, dailyMap]);

  // Overall experiment statistics across closed batches
  const experimentStats = useMemo(() => {
    const closedBatches = batchList.filter((b) => b.isComplete || b.closedCount > 0);
    const totalExperimentTrades = batchList.reduce((acc, b) => acc + b.totalTrades, 0);
    const totalWinning = batchList.reduce((acc, b) => acc + b.winningCount, 0);
    const totalClosed = batchList.reduce((acc, b) => acc + b.closedCount, 0);
    const totalRealizedPnl = batchList.reduce((acc, b) => acc + b.realizedPnlRp, 0);

    const greenDays = Object.values(dailyMap).filter((d) => d.status === "PROFIT").length;
    const redDays = Object.values(dailyMap).filter((d) => d.status === "LOSS").length;
    const activeDays = Object.values(dailyMap).filter((d) => d.status === "ACTIVE").length;

    const overallWinRate = totalClosed > 0 ? Number(((totalWinning / totalClosed) * 100).toFixed(1)) : 0;

    return {
      totalBatches: batchList.length,
      closedBatchesCount: closedBatches.length,
      totalExperimentTrades,
      totalWinning,
      totalClosed,
      totalRealizedPnl,
      overallWinRate,
      greenDays,
      redDays,
      activeDays,
    };
  }, [batchList, dailyMap]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const mStr = String(today.getMonth() + 1).padStart(2, "0");
    const dStr = String(today.getDate()).padStart(2, "0");
    setSelectedDate(`${today.getFullYear()}-${mStr}-${dStr}`);
  };

  const activeDailyData = selectedDate ? dailyMap[selectedDate] : null;

  return (
    <div className="space-y-6">
      {/* ── Top Ribbon: Key Experiment Metrics (Satoshi Style) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {/* Metric 1: Win Rate Eksperimen */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Win Rate Eksperimen
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-[#22C55E] tabular-nums">
              {experimentStats.totalClosed > 0 ? `${experimentStats.overallWinRate}%` : "-"}
            </span>
            <span className="text-xs font-semibold text-zinc-400">
              ({experimentStats.totalWinning}W / {experimentStats.totalClosed - experimentStats.totalWinning}L)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Dari {experimentStats.totalClosed} Saham Selesai Diuji
          </div>
        </div>

        {/* Metric 2: Hari Cuan vs Hari Loss */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Rasio Hari Cuan
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-[#22C55E]">
              🟢 {experimentStats.greenDays} Hari
            </span>
            <span className="text-sm font-bold text-[#FB6767]">
              🔴 {experimentStats.redDays}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {experimentStats.activeDays > 0 ? `${experimentStats.activeDays} Hari Sedang Berjalan` : "Semua Batch Selesai"}
          </div>
        </div>

        {/* Metric 3: Total Realized Profit */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Net Realized Profit
          </div>
          <div
            className={`mt-1 text-xl font-black tracking-tight tabular-nums ${
              experimentStats.totalRealizedPnl >= 0
                ? "text-[#22C55E]"
                : "text-[#FB6767]"
            }`}
          >
            {experimentStats.totalRealizedPnl >= 0 ? "+" : ""}
            {rp(experimentStats.totalRealizedPnl)}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            Dari {experimentStats.totalBatches} Batch Eksperimen
          </div>
        </div>

        {/* Metric 4: Total Batch Eksperimen */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-xl dark:border-white/10 dark:bg-[#191919]/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Batch Eksperimen
          </div>
          <div className="mt-1 text-xl font-black tracking-tight text-zinc-950 dark:text-white tabular-nums">
            {batchList.length} Batch
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {batchList.filter((b) => !b.isComplete).length > 0 ? (
              <span className="font-bold text-amber-600 dark:text-amber-400">
                ⚡ 1 Batch Sedang Aktif
              </span>
            ) : (
              "Semua Batch Ditutup"
            )}
          </div>
        </div>

        {/* Metric 5: Posisi Berjalan Hari Ini */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-4 shadow-xs backdrop-blur-xl dark:border-amber-500/20 dark:from-amber-500/15">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Uji Berjalan Hari Ini
          </div>
          <div className="mt-1 text-xl font-black tracking-tight text-amber-950 dark:text-amber-200 tabular-nums">
            {summary.openTradesCount} Saham Aktif
          </div>
          <div className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            Floating: {summary.totalUnrealizedPnlRp >= 0 ? "+" : ""}
            {rp(summary.totalUnrealizedPnlRp)}
          </div>
        </div>
      </div>

      {/* ── Main Section: Interactive Calendar View ── */}
      <Card className="overflow-hidden border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/70 p-0">
        {/* Calendar Month Header */}
        <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📅</span>
            <div>
              <h2 className="text-base font-black tracking-tight text-zinc-950 dark:text-white">
                Kalender Evaluasi Eksperimen Swing Trade
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pilih tanggal untuk melihat tingkat keberhasilan (win rate), emiten yang diuji, dan hasil profit target
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleToday}
              className="control-button rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition"
            >
              Bulan Ini
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/80">
              <button
                onClick={handlePrevMonth}
                className="h-7 w-7 rounded-lg text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white flex items-center justify-center font-bold"
                title="Bulan Sebelumnya"
              >
                ‹
              </button>
              <span className="px-3 text-xs font-black text-zinc-900 dark:text-zinc-100">
                {MONTH_NAMES_ID[currentMonth]} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="h-7 w-7 rounded-lg text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white flex items-center justify-center font-bold"
                title="Bulan Berikutnya"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-zinc-200/60 bg-zinc-50/80 text-center text-xs font-bold uppercase tracking-wider text-zinc-400 dark:border-white/[0.06] dark:bg-zinc-800/40">
          {DAY_NAMES_ID.map((name, idx) => (
            <div
              key={name}
              className={`py-2.5 ${idx >= 5 ? "text-rose-400 dark:text-rose-500/70" : ""}`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200/50 dark:divide-white/[0.06]">
          {calendarGrid.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return (
                <div
                  key={`empty_${idx}`}
                  className="min-h-12 bg-zinc-50/30 dark:bg-zinc-950/20 lg:min-h-28"
                />
              );
            }

            const data = cell.data;
            const hasData = Boolean(data && data.totalTrades > 0);
            const isSelected = selectedDate === cell.dateStr;
            const Cell = hasData ? "button" : "div";

            return (
              <Cell
                key={cell.dateStr}
                type={hasData ? "button" : undefined}
                onClick={() => hasData && setSelectedDate(cell.dateStr)}
                aria-pressed={hasData ? isSelected : undefined}
                aria-label={data && hasData ? `${cell.dayNumber} ${MONTH_NAMES_ID[currentMonth]} ${currentYear}, ${data.totalTrades} transaksi` : undefined}
                className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 p-1 text-left transition lg:min-h-28 lg:items-stretch lg:justify-between lg:p-2 ${
                  cell.isWeekend ? "bg-zinc-50/40 dark:bg-zinc-900/30" : "bg-white dark:bg-zinc-900/60"
                } ${
                  hasData
                    ? "cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/30"
                    : "cursor-default opacity-85"
                } ${
                  isSelected
                    ? "ring-2 ring-inset ring-blue-500 z-10 bg-blue-50/30 dark:bg-blue-950/40"
                    : ""
                }`}
              >
                {/* Day Number and Batch Indicator */}
                <span className="block flex items-center justify-between">
                  <span
                    className={`text-xs font-black tabular-nums ${
                      cell.isWeekend
                        ? "text-rose-400 dark:text-rose-400/80"
                        : "text-zinc-700 dark:text-zinc-300"
                    } ${isSelected ? "text-blue-600 dark:text-blue-400 font-extrabold" : ""}`}
                  >
                    {cell.dayNumber}
                  </span>

                  {data?.batchTags && data.batchTags.length > 0 && (
                    <span className="hidden min-w-0 max-w-[65px] truncate rounded bg-zinc-100 px-1 text-[9px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 lg:inline">
                      {data.batchTags[0].replace("Batch Swing ", "").replace("Batch ", "")}
                    </span>
                  )}
                </span>

                {/* Day Trading Performance Pill */}
                {data && (
                  <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full lg:hidden ${
                    { PROFIT: "bg-emerald-500", ACTIVE: "bg-amber-500", LOSS: "bg-rose-500", NEUTRAL: "bg-slate-400" }[data.status]
                  }`} />
                )}
                {data && (
                  <span className="block mt-1 hidden min-w-0 space-y-1 wrap-anywhere lg:block">
                    {/* Status 1: PROFIT DAY */}
                    {data.status === "PROFIT" && (
                      <span className="block rounded-lg border border-emerald-300 bg-emerald-50/95 p-1 text-[10px] shadow-2xs dark:border-emerald-700 dark:bg-emerald-950/80">
                        <span className="block flex flex-wrap items-center justify-between font-black text-emerald-800 dark:text-emerald-300">
                          <span>🎯 {data.winRatePct}% WR</span>
                          <span className="text-[9px] font-bold">({data.winningCount}W)</span>
                        </span>
                        <span className="block font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{rp(data.realizedPnlRp)}
                        </span>
                        <span className="block text-[9px] text-emerald-600/80 dark:text-emerald-400/70 hidden sm:block">
                          {data.closedCount} Saham Selesai
                        </span>
                      </span>
                    )}

                    {/* Status 2: ACTIVE EXPERIMENT RUNNING */}
                    {data.status === "ACTIVE" && (
                      <span className="block rounded-lg border border-amber-300 bg-amber-50/95 p-1 text-[10px] shadow-2xs dark:border-amber-700 dark:bg-amber-950/80">
                        <span className="block flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>{data.openCount} Posisi Aktif</span>
                        </span>
                        <span className="block text-[9px] font-semibold text-amber-700 dark:text-amber-400">
                          Sedang Diuji
                        </span>
                      </span>
                    )}

                    {/* Status 3: LOSS DAY */}
                    {data.status === "LOSS" && (
                      <span className="block rounded-lg border border-rose-300 bg-rose-50/95 p-1 text-[10px] shadow-2xs dark:border-rose-700 dark:bg-rose-950/80">
                        <span className="block flex items-center justify-between font-black text-rose-800 dark:text-rose-300">
                          <span>{data.winRatePct}% WR</span>
                        </span>
                        <span className="block font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                          {rp(data.realizedPnlRp)}
                        </span>
                      </span>
                    )}

                    {/* Status 4: NEUTRAL */}
                    {data.status === "NEUTRAL" && data.totalTrades > 0 && (
                      <span className="block rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                        {data.totalTrades} Transaksi
                      </span>
                    )}
                  </span>
                )}

                {/* Empty cell spacer */}
                {!data && <span className="block hidden h-4 lg:block" />}
              </Cell>
            );
          })}
        </div>
      </Card>

      {/* ── Section: Detail Rapor Harian Tanggal Terpilih ── */}
      {activeDailyData && (
        <Card className="overflow-hidden border border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/70 p-0">
          <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Rapor Hasil Eksperimen Tanggal {activeDailyData.dateLabel}
                </h3>
                {activeDailyData.status === "PROFIT" && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    🟢 Hari Profit (Win Rate {activeDailyData.winRatePct}%)
                  </span>
                )}
                {activeDailyData.status === "ACTIVE" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    🟡 Batch Sedang Berjalan ({activeDailyData.openCount} Saham Aktif)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {activeDailyData.batchTags.join(", ") || "Transaksi Swing Harian"} • Total {activeDailyData.totalTrades} Emiten Terdaftar
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-right dark:border-zinc-800 dark:bg-zinc-800/60">
                <div className="text-[10px] font-bold text-zinc-400">Total Net Realized PnL</div>
                <div
                  className={`text-sm font-black tabular-nums ${
                    activeDailyData.realizedPnlRp >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {activeDailyData.realizedPnlRp >= 0 ? "+" : ""}
                  {rp(activeDailyData.realizedPnlRp)}
                </div>
              </div>

              {activeDailyData.openCount > 0 && onCloseBatch && (
                <button
                  onClick={onCloseBatch}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 transition active:scale-95"
                  title="Tutup semua posisi pada harga terakhir yang tercatat"
                >
                  Tutup Semua Manual
                </button>
              )}
            </div>
          </div>

          {/* Table of Trades for this Date */}
          <div className="table-scroll">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200/60 bg-zinc-50/80 font-bold uppercase tracking-wider text-zinc-400 dark:border-white/[0.06] dark:bg-zinc-800/40">
                <tr>
                  <th className="px-4 py-3">Emiten</th>
                  <th className="px-4 py-3 text-right">Harga Beli &rarr; Jual</th>
                  <th className="px-4 py-3 text-right">Modal / Lot</th>
                  <th className="px-4 py-3 text-right">Realized Return</th>
                  <th className="px-4 py-3 text-center">Hasil Evaluasi Target</th>
                  <th className="px-4 py-3 text-center">Peluang Sukses</th>
                  <th className="px-4 py-3 text-center">Batch / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-white/[0.06]">
                {activeDailyData.trades.map((t) => {
                  const pnl = t.status === "OPEN" ? t.unrealizedPnlRp ?? 0 : t.realizedPnlRp ?? 0;
                  const pnlPct = t.status === "OPEN" ? t.unrealizedPnlPct ?? 0 : t.realizedPnlPct ?? 0;
                  const isUp = pnl >= 0;

                  return (
                    <tr key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition">
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
                                <span className="rounded bg-emerald-100 px-1 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  MSCI
                                </span>
                              )}
                            </div>
                            <div className="max-w-[150px] truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {t.nama}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {rp(t.entryPrice)} &rarr; {rp(t.exitPrice ?? t.currentPrice ?? t.entryPrice)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Target TP1: {rp(t.targetTp1)} | TP2: {rp(t.targetTp2)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {compact(t.totalInvested)}
                        </div>
                        <div className="text-[10px] text-zinc-400">{t.lot} Lot</div>
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

                      <td className="px-4 py-3.5 text-center">
                        {t.status === "TP2_HIT" && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400 bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <span>🎯</span> TP2 HIT (+{num(t.realizedPnlPct, 1)}%)
                          </span>
                        )}
                        {t.status === "TP1_HIT" && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-teal-400 bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800 dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                            <span>🎯</span> TP1 HIT (+{num(t.realizedPnlPct, 1)}%)
                          </span>
                        )}
                        {t.status === "SL_HIT" && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-800 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            <span>🛑</span> SL HIT ({num(t.realizedPnlPct, 1)}%)
                          </span>
                        )}
                        {t.status === "CLOSED" && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            <span>⚡</span> Manual Exit ({num(t.realizedPnlPct, 1)}%)
                          </span>
                        )}
                        {t.status === "OPEN" && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            Aktif Berjalan
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {t.convictionScore}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t.batchTag || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Section: Perbandingan Evaluasi Antar-Batch ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🏆</span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Evaluasi Kinerja Antar-Batch Eksperimen ({batchList.length} Batch)
            </h3>
          </div>
          <span className="text-xs text-zinc-400">
            Perbandingan tingkat keberhasilan sinyal Radar Swing 1-3%
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batchList.map((batch) => {
            const isProfit = batch.realizedPnlRp >= 0;
            return (
              <div
                key={batch.batchTag}
                className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-black text-sm text-zinc-950 dark:text-white">
                    {batch.batchTag}
                  </div>
                  {batch.isComplete ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      ✅ Selesai Diuji
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      ⚡ Sedang Diuji ({batch.openCount} Aktif)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Win Rate Batch</div>
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {batch.closedCount > 0 ? `${batch.winRatePct}%` : "-"}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {batch.winningCount} Menang / {batch.losingCount} Kalah
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Realized Return</div>
                    <div
                      className={`text-base font-black mt-0.5 ${
                        isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isProfit ? "+" : ""}
                      {rp(batch.realizedPnlRp)}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      ROI: {batch.realizedPnlPct >= 0 ? "+" : ""}{batch.realizedPnlPct}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <span>Total {batch.totalTrades} Saham Diuji</span>
                  <button
                    onClick={() => {
                      const firstDate = batch.trades[0]?.exitDate || batch.trades[0]?.entryDate;
                      if (firstDate) {
                        const d = new Date(firstDate);
                        const mStr = String(d.getMonth() + 1).padStart(2, "0");
                        const dStr = String(d.getDate()).padStart(2, "0");
                        setSelectedDate(`${d.getFullYear()}-${mStr}-${dStr}`);
                      }
                    }}
                    className="font-bold text-blue-600 hover:underline dark:text-blue-400 text-xs"
                  >
                    Buka Rapor &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

