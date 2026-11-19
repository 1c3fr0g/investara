import type { DividendTrapData, DividendYear } from "./types";
import { num, pct, rp } from "./format";

export function computeDividendHunter(params: {
  kode: string;
  harga: number | null;
  yield_pct: number | null;
  dps_12m: number | null;
  payout_pct: number | null;
  tahun_berturut: number;
  ex_date: string | null;
  dividen_tahunan: DividendYear[];
  beta?: number | null;
  roe_pct?: number | null;
  der?: number | null;
}): DividendTrapData {
  const {
    kode,
    harga,
    yield_pct,
    dps_12m,
    payout_pct,
    tahun_berturut,
    ex_date,
    beta,
    roe_pct,
    der,
  } = params;

  const currentYield = yield_pct ?? 0;
  const hasDividend = (dps_12m !== null && dps_12m > 0) || currentYield > 0;

  if (!hasDividend) {
    return {
      hasDividend: false,
      yieldPct: null,
      dps: null,
      payoutPct: null,
      consecutiveYears: 0,
      trapScore: 0,
      riskLevel: "RENDAH",
      riskColor: "text-zinc-400 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400",
      reboundExpectation: "Tidak Membagikan Dividen",
      estimatedExDropPct: 0,
      advice: "Emiten ini saat ini tidak membagikan dividen tunai berkala. Cocok untuk strategi capital gain murni.",
      timeline: {
        cumDate: null,
        exDate: null,
        recordingDate: null,
        paymentDate: null,
      },
    };
  }

  // Calculate Dividend Trap Risk Score (0 - 100)
  // Factors that INCREASE Dividend Trap Risk:
  // 1. Unusually high yield (> 8% = +25, > 12% = +40) - typical cyclical trap
  // 2. High payout ratio (> 80% = +15, > 100% = +30)
  // 3. High beta (> 1.2 = +15)
  // 4. Low ROE / High debt (< 8% ROE = +15, DER > 200% = +10)
  // Factors that DECREASE Dividend Trap Risk:
  // 1. Long dividend streak (>= 5 years = -15, >= 10 years = -25)
  // 2. Strong ROE (> 18% = -15)
  // 3. Low Beta (< 0.9 = -10)
  let score = 25; // baseline

  if (currentYield >= 12) score += 40;
  else if (currentYield >= 8) score += 25;
  else if (currentYield >= 5) score += 10;
  else score -= 5;

  const pr = payout_pct ?? 50;
  if (pr > 100) score += 25;
  else if (pr > 80) score += 15;
  else if (pr < 50) score -= 10;

  const b = beta ?? 1.0;
  if (b > 1.3) score += 15;
  else if (b < 0.8) score -= 10;

  if (tahun_berturut >= 10) score -= 25;
  else if (tahun_berturut >= 5) score -= 15;
  else if (tahun_berturut <= 1) score += 15;

  const roe = roe_pct ?? 10;
  if (roe < 6) score += 15;
  else if (roe > 18) score -= 15;

  const finalScore = Math.max(5, Math.min(95, Math.round(score)));

  let riskLevel: DividendTrapData["riskLevel"] = "RENDAH";
  let riskColor = "text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/30";
  let reboundExpectation = "Cepat (< 5 Hari Bursa)";
  let advice = `Dividen ${kode} tergolong aman (Defensive). Rekam jejak konsisten ${tahun_berturut} tahun berturut-turut dengan profitabilitas sehat. Aman diakumulasi untuk passive income jangka panjang.`;

  if (finalScore >= 65) {
    riskLevel = "TINGGI";
    riskColor = "text-[#FB6767] bg-[#FB6767]/10 border-[#FB6767]/30";
    reboundExpectation = "Lambat (> 1 Bulan / Risiko Tertinggal)";
    advice = `Waspada Dividend Trap! Yield tinggi (${num(currentYield, 1)}%) berpotensi memicu koreksi tajam (Ex-Date Drop) melebihi nilai dividen yang didapat. Jika hanya mengincar dividen sesaat, disarankan take profit 1-2 hari sebelum Cum Date atau tunggu beli di Ex Date setelah panic selling selesai.`;
  } else if (finalScore >= 40) {
    riskLevel = "MODERAT";
    riskColor = "text-amber-500 bg-amber-500/10 border-amber-500/30";
    reboundExpectation = "Moderat (1 - 3 Pekan)";
    advice = `Risiko trap tergolong moderat. Penurunan harga di Ex-Date diperkirakan sebanding dengan yield dividen (${num(currentYield, 1)}%). Disarankan masuk di area support Best Buy agar margin of safety tetap terjaga.`;
  }

  // Estimated drop on ex-date (approximately ~ yield + beta factor)
  const estimatedExDropPct = Number((currentYield * 0.95 + (b - 1) * 0.5).toFixed(1));

  // Determine Timeline Dates based on ex_date or estimated
  let exDateObj: Date;
  if (ex_date) {
    exDateObj = new Date(ex_date);
    if (isNaN(exDateObj.getTime())) exDateObj = new Date();
  } else {
    exDateObj = new Date();
    exDateObj.setDate(exDateObj.getDate() + 30); // estimated forward
  }

  const cumDateObj = new Date(exDateObj);
  cumDateObj.setDate(cumDateObj.getDate() - 1); // 1 day before ex

  const recordingDateObj = new Date(exDateObj);
  recordingDateObj.setDate(recordingDateObj.getDate() + 1); // 1 day after ex

  const paymentDateObj = new Date(exDateObj);
  paymentDateObj.setDate(paymentDateObj.getDate() + 14); // ~2 weeks later

  const fmt = (d: Date) =>
    d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  return {
    hasDividend: true,
    yieldPct: currentYield,
    dps: dps_12m,
    payoutPct: payout_pct,
    consecutiveYears: tahun_berturut,
    trapScore: finalScore,
    riskLevel,
    riskColor,
    reboundExpectation,
    estimatedExDropPct: Math.max(1.0, estimatedExDropPct),
    advice,
    timeline: {
      cumDate: fmt(cumDateObj),
      exDate: fmt(exDateObj),
      recordingDate: fmt(recordingDateObj),
      paymentDate: fmt(paymentDateObj),
    },
  };
}

