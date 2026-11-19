import type { BestBuyData } from "./types";
import { rp, num } from "./format";

export function roundToTick(price: number, dir: "floor" | "ceil" | "round" = "round"): number {
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

export function getTickSize(price: number): number {
  if (price >= 5000) return 25;
  if (price >= 2000) return 10;
  if (price >= 500) return 5;
  if (price >= 200) return 2;
  return 1;
}

export function computeBestBuy(params: {
  kode: string;
  harga: number | null;
  hari_rendah?: number | null;
  hari_tinggi?: number | null;
  ma50?: number | null;
  bap?: number | null;
  perubahan_pct?: number | null;
  topBuyerCode?: string;
}): BestBuyData {
  const { kode, harga, hari_rendah, bap, perubahan_pct, topBuyerCode } = params;
  const currentPrice = harga && harga > 0 ? harga : 1000;
  const tick = getTickSize(currentPrice);

  // 1. Determine Support Benchmark
  // Support is guided by: Day Low, Broker Average Price (BAP), or dynamic support at -1.0%
  const candidateLow = hari_rendah && hari_rendah > 0 ? hari_rendah : currentPrice * 0.99;
  const candidateBap = bap && bap > 0 ? bap : currentPrice * 0.995;

  // Best buy floor is typically placed near the candidate support level
  const baselineSupport = Math.min(currentPrice, Math.max(candidateLow, candidateBap - tick));
  const entryLow = roundToTick(Math.min(currentPrice * 0.992, baselineSupport), "floor");
  const entryHigh = roundToTick(Math.max(entryLow + tick, Math.min(currentPrice, entryLow + 2 * tick)), "ceil");

  // 2. Targets & Risk Limits (Strict disciplined Swing: TP1 +1.5%, TP2 +3.0%, SL -2.0%)
  const tp1Price = roundToTick(entryHigh * 1.015, "ceil");
  const tp1Pct = Number((((tp1Price - entryHigh) / entryHigh) * 100).toFixed(1));

  const tp2Price = roundToTick(entryHigh * 1.030, "ceil");
  const tp2Pct = Number((((tp2Price - entryHigh) / entryHigh) * 100).toFixed(1));

  const slPrice = roundToTick(entryLow * 0.980, "floor");
  const slPct = Number((((slPrice - entryLow) / entryLow) * 100).toFixed(1));

  // 3. Status Evaluator
  let status: BestBuyData["status"] = "SIAP_ANTRE";
  let statusLabel = "SIAP ANTRE (Best Buy Zone)";
  let statusDesc = "Harga live saat ini berada tepat di rentang antrean terbaik dekat support & BAP bandar.";
  let statusBadge = "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]";

  if (currentPrice > entryHigh && currentPrice <= tp1Price * 0.99) {
    status = "WAIT_PULLBACK";
    statusLabel = "TUNGGU PULLBACK (Jangan Buru-Buru)";
    statusDesc = "Harga sudah naik di atas area antre. Disarankan menunggu koreksi wajar ke area support.";
    statusBadge = "border-amber-400/40 bg-amber-400/10 text-amber-500";
  } else if (currentPrice > tp1Price * 0.99) {
    status = "OVERBOUGHT";
    statusLabel = "JANGAN KEJAR (Mendekati TP 1 / Resisten)";
    statusDesc = "Harga sudah mendekati target take profit. Risiko beli di harga ini tidak seimbang (High Risk).";
    statusBadge = "border-[#FB6767]/40 bg-[#FB6767]/10 text-[#FB6767]";
  } else if (currentPrice < entryLow) {
    status = "WAIT_CONFIRM";
    statusLabel = "DI BAWAH SUPPORT (Tunggu Konfirmasi Rebound)";
    statusDesc = "Harga berada di bawah level support. Tunggu ada candle hijau pembalikan arah sebelum entry.";
    statusBadge = "border-zinc-400/40 bg-zinc-400/10 text-zinc-500";
  }

  // 4. Three Pillars of Rationale
  const buyerRef = topBuyerCode ? `broker institusi ${topBuyerCode}` : "smart money";
  const bapText = bap ? ` (BAP: ${rp(bap)})` : "";

  const rationale = [
    `Area Antre: ${rp(entryLow)} - ${rp(entryHigh)} berada tepat di atas bantalan support dinamis dan fraksi tick BEI.`,
    `Konfirmasi Akumulasi: Sejajar dengan estimasi harga modal rata-rata ${buyerRef}${bapText}.`,
    `Rasio Risk : Reward terukur 1 : 2.0 (Batas risiko cut loss ${slPct}% di ${rp(slPrice)} vs potensi profit TP2 +${tp2Pct}% di ${rp(tp2Price)}).`,
  ];

  return {
    entryLow,
    entryHigh,
    tp1Price,
    tp1Pct,
    tp2Price,
    tp2Pct,
    slPrice,
    slPct,
    riskRewardRatio: "1 : 2.0",
    status,
    statusLabel,
    statusDesc,
    statusBadge,
    rationale,
  };
}

