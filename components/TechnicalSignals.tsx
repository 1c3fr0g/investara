"use client";

import { useMemo } from "react";
import { analyzeTechnicals, type TechnicalSummary } from "@/lib/technical";
import type { PricePoint } from "@/lib/types";
import { Card } from "./ui";
import { num } from "@/lib/format";

export function TechnicalSignals({
  riwayat,
  harga,
  kode,
}: {
  riwayat: PricePoint[];
  harga: number | null;
  kode: string;
}) {
  const summary: TechnicalSummary = useMemo(() => {
    return analyzeTechnicals(riwayat, harga);
  }, [riwayat, harga]);

  const toneBg = {
    "SANGAT BULLISH": "bg-emerald-600 text-white",
    BULLISH: "bg-emerald-500 text-white",
    NETRAL: "bg-amber-500 text-white",
    BEARISH: "bg-rose-500 text-white",
    "SANGAT BEARISH": "bg-rose-700 text-white",
  }[summary.overall];

  const actionBadge = (act: "BELI" | "JUAL" | "NETRAL") => {
    if (act === "BELI")
      return (
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          BELI
        </span>
      );
    if (act === "JUAL")
      return (
        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          JUAL
        </span>
      );
    return (
      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        NETRAL
      </span>
    );
  };

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-100">
            Analisis Indikator Teknikal {kode}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Berdasarkan pergerakan harga historis, momentum (RSI), tren MACD, dan Moving Average.
          </p>
        </div>

        {/* Overall Signal Meter */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Sinyal Keseluruhan</span>
            <span className={`inline-block rounded-xl px-3 py-1 text-sm font-extrabold shadow-sm ${toneBg}`}>
              {summary.overall}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Score Bar */}
      <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
        <div className="mb-2 flex justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{summary.buyCount} Indikator Beli</span>
          <span className="text-zinc-500 dark:text-zinc-400">{summary.neutralCount} Netral</span>
          <span className="text-rose-600 dark:text-rose-400 font-bold">{summary.sellCount} Indikator Jual</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            style={{ width: `${(summary.buyCount / (summary.indicators.length || 1)) * 100}%` }}
            className="bg-emerald-500 transition-all duration-300"
          />
          <div
            style={{ width: `${(summary.neutralCount / (summary.indicators.length || 1)) * 100}%` }}
            className="bg-amber-400 transition-all duration-300"
          />
          <div
            style={{ width: `${(summary.sellCount / (summary.indicators.length || 1)) * 100}%` }}
            className="bg-rose-500 transition-all duration-300"
          />
        </div>
      </div>

      {/* Key Indicator Highlight Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* RSI Box */}
        <div className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">RSI (14 Periode)</span>
            {actionBadge(summary.rsi.action)}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {summary.rsi.value !== null ? num(summary.rsi.value, 1) : "-"}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              style={{ width: `${Math.min(100, Math.max(0, summary.rsi.value ?? 50))}%` }}
              className={`h-full ${
                (summary.rsi.value ?? 50) <= 30
                  ? "bg-emerald-500"
                  : (summary.rsi.value ?? 50) >= 70
                  ? "bg-rose-500"
                  : "bg-amber-400"
              }`}
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Status: <strong>{summary.rsi.status}</strong> (&lt;30 Oversold, &gt;70 Overbought)
          </p>
        </div>

        {/* MACD Box */}
        <div className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">MACD (12, 26, 9)</span>
            {actionBadge(summary.macd.action)}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {summary.macd.macd !== null ? num(summary.macd.macd, 2) : "-"}
          </div>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Signal: {summary.macd.signal !== null ? num(summary.macd.signal, 2) : "-"} | Hist:{" "}
            {summary.macd.hist !== null ? num(summary.macd.hist, 2) : "-"}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Status: <strong>{summary.macd.status}</strong>
          </p>
        </div>

        {/* MA Cross Box */}
        <div className="rounded-xl border border-zinc-200 p-3.5 sm:col-span-2 lg:col-span-1 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Moving Average Trend</span>
            {summary.ma.goldenCross ? actionBadge("BELI") : actionBadge("NETRAL")}
          </div>
          <div className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {summary.ma.goldenCross
              ? "Golden Cross Terdeteksi"
              : summary.ma.deathCross
              ? "Death Cross Terdeteksi"
              : "Tren MA Normal"}
          </div>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            MA20: {summary.ma.ma20 ? `Rp ${summary.ma.ma20.toLocaleString("id-ID")}` : "-"}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            MA50: {summary.ma.ma50 ? `Rp ${summary.ma.ma50.toLocaleString("id-ID")}` : "-"} | MA200:{" "}
            {summary.ma.ma200 ? `Rp ${summary.ma.ma200.toLocaleString("id-ID")}` : "-"}
          </p>
        </div>
      </div>

      {/* Complete Indicators Table */}
      <div className="table-scroll rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-3">Nama Indikator</th>
              <th className="px-4 py-3">Nilai</th>
              <th className="px-4 py-3">Sinyal</th>
              <th className="px-4 py-3">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {summary.indicators.map((ind) => (
              <tr key={ind.name} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{ind.name}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{ind.value}</td>
                <td className="px-4 py-3">{actionBadge(ind.action)}</td>
                <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{ind.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

