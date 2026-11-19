import type { Analysis, Check, Detail, KategoriSkor, Status } from "./types";
import { compact, num, pct, rp } from "./format";

type Input = Omit<Detail, "analisis">;

const pts: Record<Status, number> = { good: 1, warn: 0.5, bad: 0, na: 0 };

function check(label: string, value: number | null, fmt: string, rate: (v: number) => [Status, string]): Check {
  if (value === null) return { label, value: "-", status: "na", note: "Data tidak tersedia" };
  const [status, note] = rate(value);
  return { label, value: fmt, status, note };
}

export function analyze(d: Input): Analysis {
  const checks: Check[] = [];

  checks.push(
    check("Dividend yield", d.yield_pct, pct(d.yield_pct), (v) =>
      v >= 3 && v <= 10 ? ["good", "Yield sehat (3-10%)"]
      : v > 10 ? ["warn", "Sangat tinggi, cek keberlanjutan dividen"]
      : v > 0 ? ["warn", "Yield rendah (<3%)"]
      : ["bad", "Tidak membayar dividen"]),
    check("Konsistensi dividen", d.tahun_berturut, `${d.tahun_berturut} tahun`, (v) =>
      v >= 5 ? ["good", "Rutin membayar dividen 5 tahun atau lebih"]
      : v >= 3 ? ["warn", "Cukup konsisten"]
      : ["bad", "Riwayat dividen pendek"]),
    check("Pertumbuhan DPS (CAGR 5 thn)", d.cagr_dps_pct, pct(d.cagr_dps_pct), (v) =>
      v >= 5 ? ["good", "Dividen tumbuh stabil"]
      : v >= 0 ? ["warn", "Dividen relatif datar"]
      : ["bad", "Dividen menurun"]),
    check("Payout ratio", d.payout_pct, pct(d.payout_pct, 1), (v) =>
      v >= 30 && v <= 90 ? ["good", "Porsi dividen seimbang (30-90%)"]
      : v > 100 ? ["bad", "Dividen melebihi laba"]
      : ["warn", v < 30 ? "Porsi dividen rendah" : "Mendekati batas atas"]),
    check("ROE", d.roe_pct, pct(d.roe_pct, 1), (v) =>
      v >= 15 ? ["good", "Profitabilitas tinggi"]
      : v >= 10 ? ["warn", "Profitabilitas cukup"]
      : ["bad", "Profitabilitas rendah"]),
    check("Margin laba bersih", d.margin_laba_pct, pct(d.margin_laba_pct, 1), (v) =>
      v >= 10 ? ["good", "Margin sehat"] : v > 0 ? ["warn", "Margin tipis"] : ["bad", "Merugi"]),
    check("PER", d.per, num(d.per, 1) + "x", (v) =>
      v > 0 && v <= 15 ? ["good", "Valuasi wajar atau murah"]
      : v > 0 && v <= 25 ? ["warn", "Valuasi cukup tinggi"]
      : v > 25 ? ["bad", "Valuasi mahal"]
      : ["bad", "Laba negatif"]),
    check("PBV", d.pbv, num(d.pbv, 2) + "x", (v) =>
      v <= 2 ? ["good", "Dihargai wajar terhadap nilai buku"]
      : v <= 4 ? ["warn", "Premi terhadap nilai buku"]
      : ["bad", "Premi tinggi"]),
    check("Pertumbuhan laba", d.pertumbuhan_laba_pct, pct(d.pertumbuhan_laba_pct, 1), (v) =>
      v >= 5 ? ["good", "Laba bertumbuh"] : v >= 0 ? ["warn", "Laba relatif datar"] : ["bad", "Laba menurun"]),
    check("Pertumbuhan pendapatan", d.pertumbuhan_pendapatan_pct, pct(d.pertumbuhan_pendapatan_pct, 1), (v) =>
      v >= 5 ? ["good", "Pendapatan bertumbuh"] : v >= 0 ? ["warn", "Pendapatan relatif datar"] : ["bad", "Pendapatan menurun"]),
    check("Debt to equity", d.der, num(d.der, 1) + "%", (v) =>
      v <= 100 ? ["good", "Utang terkendali"] : v <= 200 ? ["warn", "Utang cukup besar"] : ["bad", "Utang tinggi"]),
    check("Potensi menurut analis", d.target_rata !== null && d.harga ? (d.target_rata / d.harga - 1) * 100 : null,
      d.target_rata !== null && d.harga ? pct((d.target_rata / d.harga - 1) * 100, 1) : "-", (v) =>
      v >= 15 ? ["good", `Target rata-rata ${rp(d.target_rata)}`]
      : v >= 0 ? ["warn", `Target rata-rata ${rp(d.target_rata)}`]
      : ["bad", `Harga di atas target ${rp(d.target_rata)}`]),
    check("Likuiditas (nilai transaksi/hari)",
      d.volume_rata !== null && d.harga ? d.volume_rata * d.harga : null,
      d.volume_rata !== null && d.harga ? compact(d.volume_rata * d.harga) : "-", (v) =>
      v >= 5e9 ? ["good", "Mudah diperdagangkan"] : v >= 1e9 ? ["warn", "Likuiditas sedang"] : ["bad", "Likuiditas rendah"]),
    check("Posisi terhadap MA200", d.ma200 !== null && d.harga ? (d.harga / d.ma200 - 1) * 100 : null,
      d.ma200 !== null && d.harga ? pct((d.harga / d.ma200 - 1) * 100, 1) : "-", (v) =>
      v >= 0 ? ["good", "Harga di atas rata-rata 200 hari"] : ["warn", "Harga di bawah rata-rata 200 hari"]),
    check("Beta (volatilitas vs pasar)", d.beta, num(d.beta, 2), (v) =>
      v <= 1 ? ["good", "Lebih stabil dari pasar"] : v <= 1.5 ? ["warn", "Sedikit lebih fluktuatif dari pasar"] : ["bad", "Sangat fluktuatif"]),
  );

  const KATEGORI: Record<string, { nama: string; bobot: number }> = {
    "Dividend yield": { nama: "Dividen", bobot: 30 },
    "Konsistensi dividen": { nama: "Dividen", bobot: 30 },
    "Pertumbuhan DPS (CAGR 5 thn)": { nama: "Dividen", bobot: 30 },
    "Payout ratio": { nama: "Dividen", bobot: 30 },
    ROE: { nama: "Profitabilitas", bobot: 20 },
    "Margin laba bersih": { nama: "Profitabilitas", bobot: 20 },
    PER: { nama: "Valuasi", bobot: 20 },
    PBV: { nama: "Valuasi", bobot: 20 },
    "Potensi menurut analis": { nama: "Valuasi", bobot: 20 },
    "Pertumbuhan laba": { nama: "Pertumbuhan", bobot: 15 },
    "Pertumbuhan pendapatan": { nama: "Pertumbuhan", bobot: 15 },
    "Debt to equity": { nama: "Risiko", bobot: 15 },
    "Likuiditas (nilai transaksi/hari)": { nama: "Risiko", bobot: 15 },
    "Posisi terhadap MA200": { nama: "Risiko", bobot: 15 },
    "Beta (volatilitas vs pasar)": { nama: "Risiko", bobot: 15 },
  };
  for (const c of checks) c.kategori = KATEGORI[c.label]?.nama;

  const kategori: KategoriSkor[] = [];
  for (const nama of ["Dividen", "Valuasi", "Profitabilitas", "Pertumbuhan", "Risiko"]) {
    const items = checks.filter((c) => c.kategori === nama);
    const rated = items.filter((c) => c.status !== "na");
    const bobot = Object.values(KATEGORI).find((k) => k.nama === nama)!.bobot;
    const skor = rated.length ? Math.round((rated.reduce((s, c) => s + pts[c.status], 0) / rated.length) * 100) : null;
    const baik = rated.filter((c) => c.status === "good").length;
    kategori.push({ nama, skor, bobot, ringkas: rated.length ? `${baik} dari ${rated.length} indikator baik` : "Data tidak tersedia" });
  }

  const dinilai = kategori.filter((k) => k.skor !== null);
  const totalBobot = dinilai.reduce((s, k) => s + k.bobot, 0);
  const rated = checks.filter((c) => c.status !== "na");
  const score = totalBobot ? Math.round(dinilai.reduce((s, k) => s + k.skor! * k.bobot, 0) / totalBobot) : 0;
  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "E";
  const verdict =
    rated.length < 5 ? "Data belum cukup untuk dinilai"
    : score >= 70 ? "Fundamental menarik"
    : score >= 50 ? "Cukup, perlu pertimbangan"
    : "Kurang menarik";
  return { score, grade, verdict, checks, kategori };
}
