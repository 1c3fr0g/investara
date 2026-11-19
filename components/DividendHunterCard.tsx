"use client";

import type { DividendTrapData } from "@/lib/types";
import { num, pct, rp } from "@/lib/format";

interface DividendHunterCardProps {
  kode: string;
  harga: number | null;
  dividendData?: DividendTrapData;
}

export function DividendHunterCard({ kode, harga, dividendData }: DividendHunterCardProps) {
  if (!dividendData || !dividendData.hasDividend) return null;

  const isLowRisk = dividendData.riskLevel === "RENDAH";
  const isHighRisk = dividendData.riskLevel === "TINGGI";

  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white/95 p-6 shadow-[0_4px_24px_rgba(25,25,25,0.02)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#191919]/90 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#191919] text-xs font-black text-white dark:bg-white dark:text-[#191919]">
              💰
            </span>
            <h2 className="text-base font-black tracking-tight text-[#191919] dark:text-white">
              Dividend Hunter &amp; Trap Protector Matrix
            </h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${dividendData.riskColor}`}
            >
              Risiko Trap: {dividendData.riskLevel} ({dividendData.trapScore}%)
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Evaluasi potensi passive income vs risiko penurunan harga pada Ex-Date (*Ex-Dividend Drop*).
          </p>
        </div>

        {/* Quick Yield Pill */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-2 text-center dark:border-emerald-800/40 dark:bg-emerald-950/20 shrink-0 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            Dividend Yield Terkini
          </div>
          <div className="text-xl font-black text-[#22C55E] tabular-nums">
            {pct(dividendData.yieldPct)}
          </div>
          <div className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-400/80">
            DPS: {rp(dividendData.dps)} / lembar
          </div>
        </div>
      </div>

      {/* Key Metric Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-[10px] font-bold text-zinc-400">Payout Ratio (DPR)</div>
          <div className="mt-1 text-base font-black text-[#191919] dark:text-white tabular-nums">
            {pct(dividendData.payoutPct, 1)}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {dividendData.payoutPct && dividendData.payoutPct > 80 ? "Porsi Laba Jumbo" : "Sehat & Berkelanjutan"}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-[10px] font-bold text-zinc-400">Konsistensi Pembagian</div>
          <div className="mt-1 text-base font-black text-[#191919] dark:text-white tabular-nums">
            {dividendData.consecutiveYears} Tahun
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Berturut-turut membagi</div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-[10px] font-bold text-zinc-400">Estimasi Ex-Date Drop</div>
          <div className="mt-1 text-base font-black text-[#FB6767] tabular-nums">
            -{dividendData.estimatedExDropPct}%
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Penurunan saat ex-date</div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-[10px] font-bold text-zinc-400">Ekspektasi Rebound</div>
          <div className="mt-1 text-base font-black text-[#191919] dark:text-white">
            {dividendData.reboundExpectation}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Waktu harga pulih</div>
        </div>
      </div>

      {/* Dividend Trap Risk Meter */}
      <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.02] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#191919] dark:text-white flex items-center gap-1.5">
            <span>🛡️</span> Indikator Proteksi Dividend Trap:
          </span>
          <span className="font-extrabold tabular-nums">
            Skor Risiko: {dividendData.trapScore} / 100
          </span>
        </div>

        {/* Visual Progress Meter */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHighRisk
                ? "bg-[#FB6767]"
                : isLowRisk
                ? "bg-[#22C55E]"
                : "bg-amber-500"
            }`}
            style={{ width: `${dividendData.trapScore}%` }}
          />
        </div>

        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          {dividendData.advice}
        </p>
      </div>

      {/* Interactive Dividend Timeline Stepper */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-[#191919] dark:text-white">
          📅 Jadwal Siklus Dividen Terdekat:
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Step 1: Cum Date */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-[#191919]">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#191919] text-[10px] font-black text-white dark:bg-white dark:text-[#191919]">
                1
              </span>
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Cum Date</span>
            </div>
            <div className="mt-2 text-xs font-black text-[#191919] dark:text-white">
              {dividendData.timeline.cumDate || "-"}
            </div>
            <p className="mt-1 text-[10px] text-zinc-400 leading-snug">
              Batas akhir beli agar sah menerima dividen.
            </p>
          </div>

          {/* Step 2: Ex Date */}
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/20 p-3.5 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/20">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FB6767] text-[10px] font-black text-white">
                2
              </span>
              <span className="text-[11px] font-bold text-[#FB6767]">Ex Date</span>
            </div>
            <div className="mt-2 text-xs font-black text-[#FB6767]">
              {dividendData.timeline.exDate || "-"}
            </div>
            <p className="mt-1 text-[10px] text-zinc-400 leading-snug">
              Perdagangan tanpa hak dividen (koreksi harga).
            </p>
          </div>

          {/* Step 3: Recording Date */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-[#191919]">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#191919] text-[10px] font-black text-white dark:bg-white dark:text-[#191919]">
                3
              </span>
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Recording Date</span>
            </div>
            <div className="mt-2 text-xs font-black text-[#191919] dark:text-white">
              {dividendData.timeline.recordingDate || "-"}
            </div>
            <p className="mt-1 text-[10px] text-zinc-400 leading-snug">
              Pencatatan daftar pemegang saham resmi di KSEI.
            </p>
          </div>

          {/* Step 4: Payment Date */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-3.5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E] text-[10px] font-black text-white">
                4
              </span>
              <span className="text-[11px] font-bold text-[#22C55E]">Payment Date</span>
            </div>
            <div className="mt-2 text-xs font-black text-[#22C55E]">
              {dividendData.timeline.paymentDate || "-"}
            </div>
            <p className="mt-1 text-[10px] text-zinc-400 leading-snug">
              Dana tunai dividen masuk ke RDN sekuritas Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

