"use client";

import { useState } from "react";
import type { BestBuyData } from "@/lib/types";
import { rp, num } from "@/lib/format";
import { usePaperTrading } from "@/lib/paperTrading";

interface BestBuyCardProps {
  kode: string;
  nama: string;
  harga: number | null;
  bestBuy?: BestBuyData;
  onSetAlert?: (price: number) => void;
}

export function BestBuyCard({ kode, nama, harga, bestBuy, onSetAlert }: BestBuyCardProps) {
  const { openTrade, openTrades } = usePaperTrading();
  const [toast, setToast] = useState<string | null>(null);

  if (!bestBuy || !harga) return null;

  const isSimulated = openTrades.some((t) => t.kode === kode && t.status === "OPEN");

  const handleSimulate = () => {
    const recommendedLot = Math.max(5, Math.min(100, Math.round(5_000_000 / (harga * 100))));
    const trade = openTrade({
      kode,
      nama,
      entryPrice: bestBuy.entryHigh,
      lot: recommendedLot,
      convictionScore: 90,
      targetTp1Pct: bestBuy.tp1Pct,
      targetTp2Pct: bestBuy.tp2Pct,
      stopLossPct: bestBuy.slPct,
      notes: `Best Buy Zone Entry di ${rp(bestBuy.entryHigh)} (${bestBuy.statusLabel})`,
    });

    setToast(trade
      ? `Simulasi ${kode} dibuka di ${rp(bestBuy.entryHigh)} (${recommendedLot} lot).`
      : `Saldo simulasi belum cukup untuk membuka ${recommendedLot} lot ${kode}.`);
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/95 p-6 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#191919]/90 space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div className="rounded-2xl border border-emerald-400 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
          {toast}
        </div>
      )}

      {/* Header Row: Title & Action Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#191919] text-xs font-black text-white dark:bg-white dark:text-[#191919]">
              🎯
            </span>
            <h2 className="text-base font-black tracking-tight text-[#191919] dark:text-white">
              Panduan Masuk &amp; Best Buy Zone
            </h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${bestBuy.statusBadge}`}
            >
              {bestBuy.statusLabel}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
            {bestBuy.statusDesc}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSimulate}
            disabled={isSimulated}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-2xs active:scale-95 ${
              isSimulated
                ? "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                : "bg-[#191919] hover:bg-black text-white dark:bg-white dark:text-[#191919]"
            }`}
          >
            <span>{isSimulated ? "✓" : "+"}</span>
            <span>{isSimulated ? "Di Simulasi" : "Simulasi Masuk"}</span>
          </button>

          {onSetAlert && (
            <button
              onClick={() => onSetAlert(bestBuy.entryHigh)}
              className="flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 transition shadow-2xs active:scale-95"
            >
              <span>🔔</span>
              <span>Alert Beli</span>
            </button>
          )}

          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("open-ai-chat", {
                  detail: {
                    asset: kode,
                    type: "stock",
                    initialPrompt: `Bagaimana analisis Best Buy Zone untuk saham ${kode} pada rentang ${rp(bestBuy.entryLow)} - ${rp(bestBuy.entryHigh)}? Apakah konfirmasi volume flow dan bandarmologi saat ini mendukung untuk antre beli?`,
                  },
                })
              );
            }}
            className="flex items-center gap-1 rounded-xl border border-[#9A83FF]/30 bg-[#9A83FF]/10 px-3 py-2 text-xs font-bold text-[#9A83FF] hover:bg-[#9A83FF]/20 transition shadow-2xs active:scale-95"
          >
            <span>🤖</span>
            <span>AI</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Price Range & Key Strategy Levels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Box 1: Best Buy Range */}
        <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/50 p-4 shadow-2xs dark:border-emerald-800/40 dark:bg-emerald-950/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            Area Antre Terbaik (Best Bid)
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-emerald-950 dark:text-emerald-200 tabular-nums">
            {rp(bestBuy.entryLow)} - {rp(bestBuy.entryHigh)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80">
            Fraksi Tick Support BEI
          </div>
        </div>

        {/* Box 2: Target Take Profit 1 */}
        <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] p-4 shadow-2xs dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Target Profit 1 (TP 1)
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-[#22C55E] tabular-nums">
            {rp(bestBuy.tp1Price)}
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#22C55E] tabular-nums">
            +{num(bestBuy.tp1Pct, 1)}%
          </div>
        </div>

        {/* Box 3: Target Take Profit 2 */}
        <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] p-4 shadow-2xs dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Target Profit 2 (TP 2)
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-[#22C55E] tabular-nums">
            {rp(bestBuy.tp2Price)}
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#22C55E] tabular-nums">
            +{num(bestBuy.tp2Pct, 1)}%
          </div>
        </div>

        {/* Box 4: Stop Loss / Cut Loss */}
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
            Batas Cut Loss (Disiplin SL)
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-[#FB6767] tabular-nums">
            {rp(bestBuy.slPrice)}
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#FB6767] tabular-nums">
            {num(bestBuy.slPct, 1)}%
          </div>
        </div>
      </div>

      {/* Rationale Section: Why This Price? */}
      <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.02] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#191919] dark:text-zinc-200">
            💡 3 Alasan Teknis &amp; Konfirmasi Bandarmologi:
          </span>
          <span className="rounded-md bg-zinc-200/70 px-2 py-0.5 text-[10px] font-black text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
            Risk:Reward {bestBuy.riskRewardRatio}
          </span>
        </div>
        <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          {bestBuy.rationale.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[#22C55E] font-bold">✓</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

