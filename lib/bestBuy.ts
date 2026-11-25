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

export function projectSwingPrices(reference: number | null) {
  if (reference === null || !Number.isFinite(reference) || reference <= 1) return null;
  return {
    tp1: roundToTick(reference * 1.015, "ceil"),
    tp2: roundToTick(reference * 1.03, "ceil"),
    downside: roundToTick(reference * 0.98, "floor"),
  };
}

export function computeBestBuy({ harga, hari_rendah }: {
  harga: number | null;
  hari_rendah: number | null;
}): BestBuyData | undefined {
  if (harga === null || !Number.isFinite(harga) || harga <= 1) return undefined;
  const dayLow = hari_rendah !== null && hari_rendah > 0 && hari_rendah <= harga ? hari_rendah : null;
  const tick = getTickSize(harga);
  const entryLow = roundToTick(Math.min(harga * 0.992, dayLow ?? harga * 0.99), "floor");
  const entryHigh = roundToTick(Math.max(entryLow + tick, Math.min(harga, entryLow + 2 * tick)), "ceil");
  const levels = projectSwingPrices(entryHigh);
  if (!levels) return undefined;
  const { tp1: tp1Price, tp2: tp2Price, downside: slPrice } = levels;
  const changeFromEntry = (price: number) => (price / entryHigh - 1) * 100;
  const riskRewardRatio = `1 : ${num((tp2Price - entryHigh) / (entryHigh - slPrice), 2)}`;

  let status: BestBuyData["status"] = "SIAP_ANTRE";
  let statusLabel = "Dalam rentang entry";
  let statusDesc = "Harga berada dalam rentang entry skenario.";
  let statusBadge = "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (harga >= tp1Price) {
    status = "OVERBOUGHT";
    statusLabel = "Sudah mencapai target pertama";
    statusDesc = "Harga telah mencapai target pertama dari skenario entry ini.";
    statusBadge = "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  } else if (harga > entryHigh) {
    status = "WAIT_PULLBACK";
    statusLabel = "Di atas rentang entry";
    statusDesc = "Harga masih di atas rentang entry skenario.";
    statusBadge = "border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-300";
  }

  return {
    entryLow, entryHigh, tp1Price, tp1Pct: changeFromEntry(tp1Price),
    tp2Price, tp2Pct: changeFromEntry(tp2Price), slPrice, slPct: changeFromEntry(slPrice),
    riskRewardRatio, status, statusLabel, statusDesc, statusBadge,
    rationale: [
      `Rentang skenario ${rp(entryLow)} sampai ${rp(entryHigh)} mengikuti fraksi harga.`,
      dayLow !== null ? `Harga terendah sesi yang dilaporkan ${rp(dayLow)}.` : "Skenario memakai harga terakhir sebagai acuan.",
      `Perbandingan risiko terhadap target kedua ${riskRewardRatio} sebelum biaya.`,
    ],
  };
}

