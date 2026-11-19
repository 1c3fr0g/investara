export { MSCI_STANDARD, MSCI_SMALLCAP, MSCI_ALL } from "./groups";
import { MSCI_STANDARD, MSCI_SMALLCAP, MSCI_ALL } from "./groups";

export interface MsciConstituentMeta {
  kode: string;
  nama: string;
  type: "STANDARD" | "SMALL_CAP";
  estimatedWeight: number; // Percentage estimated in MSCI Indonesia Index
  tier: "TOP 5 HEAVYWEIGHT" | "CORE LARGE CAP" | "MID CAP" | "GROWTH SMALL CAP";
  sector: string;
  rebalanceNotes?: string;
}

export const MSCI_METADATA: Record<string, MsciConstituentMeta> = {
  // --- TOP HEAVYWEIGHTS (STANDARD) ---
  BBCA: {
    kode: "BBCA",
    nama: "Bank Central Asia Tbk",
    type: "STANDARD",
    estimatedWeight: 26.5,
    tier: "TOP 5 HEAVYWEIGHT",
    sector: "Keuangan",
    rebalanceNotes: "Pilar utama indeks dengan bobot terbesar dan likuiditas asing tertinggi.",
  },
  BBRI: {
    kode: "BBRI",
    nama: "Bank Rakyat Indonesia (Persero) Tbk",
    type: "STANDARD",
    estimatedWeight: 17.2,
    tier: "TOP 5 HEAVYWEIGHT",
    sector: "Keuangan",
    rebalanceNotes: "Bobot perbankan BUMN terbesar kedua, target utama inflow pasif institusi global.",
  },
  BMRI: {
    kode: "BMRI",
    nama: "Bank Mandiri (Persero) Tbk",
    type: "STANDARD",
    estimatedWeight: 14.8,
    tier: "TOP 5 HEAVYWEIGHT",
    sector: "Keuangan",
    rebalanceNotes: "Saham perbankan dengan pertumbuhan laba solid dan dividend payout stabil.",
  },
  TLKM: {
    kode: "TLKM",
    nama: "Telkom Indonesia (Persero) Tbk",
    type: "STANDARD",
    estimatedWeight: 8.5,
    tier: "TOP 5 HEAVYWEIGHT",
    sector: "Infrastruktur",
    rebalanceNotes: "Raksasa telekomunikasi nasional penggerak defensif indeks.",
  },
  ASII: {
    kode: "ASII",
    nama: "Astra International Tbk",
    type: "STANDARD",
    estimatedWeight: 5.4,
    tier: "TOP 5 HEAVYWEIGHT",
    sector: "Perindustrian",
    rebalanceNotes: "Konglomerasi otomotif dan alat berat dengan valuasi atraktif.",
  },
  BBNI: {
    kode: "BBNI",
    nama: "Bank Negara Indonesia (Persero) Tbk",
    type: "STANDARD",
    estimatedWeight: 4.2,
    tier: "CORE LARGE CAP",
    sector: "Keuangan",
    rebalanceNotes: "Valuasi PBV relatif murah dibanding bank big 4 lainnya.",
  },
  AMMN: {
    kode: "AMMN",
    nama: "Amman Mineral Internasional Tbk",
    type: "STANDARD",
    estimatedWeight: 3.9,
    tier: "CORE LARGE CAP",
    sector: "Barang Baku",
    rebalanceNotes: "Pertambangan tembaga dan emas modern dengan kapasitas smelter raksasa.",
  },
  BREN: {
    kode: "BREN",
    nama: "Barito Renewables Energy Tbk",
    type: "STANDARD",
    estimatedWeight: 3.2,
    tier: "CORE LARGE CAP",
    sector: "Infrastruktur",
    rebalanceNotes: "Energi terbarukan geotermal terbesar di Asia Tenggara.",
  },
  BRPT: {
    kode: "BRPT",
    nama: "Barito Pacific Tbk",
    type: "STANDARD",
    estimatedWeight: 2.1,
    tier: "CORE LARGE CAP",
    sector: "Barang Baku",
    rebalanceNotes: "Induk holding petrokimia dan energi Barito Group.",
  },
  CPIN: {
    kode: "CPIN",
    nama: "Charoen Pokphand Indonesia Tbk",
    type: "STANDARD",
    estimatedWeight: 1.8,
    tier: "CORE LARGE CAP",
    sector: "Barang Konsumen Primer",
    rebalanceNotes: "Pemimpin industri unggas terintegrasi nasional.",
  },
  ICBP: {
    kode: "ICBP",
    nama: "Indofood CBP Sukses Makmur Tbk",
    type: "STANDARD",
    estimatedWeight: 1.7,
    tier: "CORE LARGE CAP",
    sector: "Barang Konsumen Primer",
    rebalanceNotes: "Produsen mie instan global dengan penetrasi pasar internasional kuat.",
  },
  INDF: {
    kode: "INDF",
    nama: "Indofood Sukses Makmur Tbk",
    type: "STANDARD",
    estimatedWeight: 1.6,
    tier: "CORE LARGE CAP",
    sector: "Barang Konsumen Primer",
    rebalanceNotes: "Induk perusahaan makanan terpadu dengan dividen konsisten.",
  },
  INKP: {
    kode: "INKP",
    nama: "Indah Kiat Pulp & Paper Tbk",
    type: "STANDARD",
    estimatedWeight: 1.4,
    tier: "CORE LARGE CAP",
    sector: "Barang Baku",
    rebalanceNotes: "Produsen kertas dan bubur kertas ekspor berdaya saing global.",
  },
  KLBF: {
    kode: "KLBF",
    nama: "Kalbe Farma Tbk",
    type: "STANDARD",
    estimatedWeight: 1.3,
    tier: "CORE LARGE CAP",
    sector: "Kesehatan",
    rebalanceNotes: "Raksasa farmasi dan produk kesehatan konsumen terdepan.",
  },
  MDKA: {
    kode: "MDKA",
    nama: "Merdeka Copper Gold Tbk",
    type: "STANDARD",
    estimatedWeight: 1.2,
    tier: "CORE LARGE CAP",
    sector: "Barang Baku",
    rebalanceNotes: "Eksplorasi emas, tembaga, dan baterai nikel berkelanjutan.",
  },
  PGAS: {
    kode: "PGAS",
    nama: "Perusahaan Gas Negara Tbk",
    type: "STANDARD",
    estimatedWeight: 1.1,
    tier: "CORE LARGE CAP",
    sector: "Energi",
    rebalanceNotes: "Distribusi gas bumi nasional dengan dividend yield tinggi.",
  },
  UNTR: {
    kode: "UNTR",
    nama: "United Tractors Tbk",
    type: "STANDARD",
    estimatedWeight: 1.5,
    tier: "CORE LARGE CAP",
    sector: "Perindustrian",
    rebalanceNotes: "Distributor alat berat Komatsu dan diversifikasi ke tambang emas & nikel.",
  },
  UNVR: {
    kode: "UNVR",
    nama: "Unilever Indonesia Tbk",
    type: "STANDARD",
    estimatedWeight: 0.9,
    tier: "MID CAP",
    sector: "Barang Konsumen Primer",
    rebalanceNotes: "Produk kebutuhan harian konsumen dengan merek legendaris.",
  },
  ADRO: {
    kode: "ADRO",
    nama: "Adaro Energy Indonesia Tbk",
    type: "STANDARD",
    estimatedWeight: 1.3,
    tier: "CORE LARGE CAP",
    sector: "Energi",
    rebalanceNotes: "Energi batubara dan transformasi menuju energi hijau terbarukan.",
  },
  GOTO: {
    kode: "GOTO",
    nama: "GoTo Gojek Tokopedia Tbk",
    type: "STANDARD",
    estimatedWeight: 1.2,
    tier: "MID CAP",
    sector: "Teknologi",
    rebalanceNotes: "Ekosistem digital on-demand & fintech terbesar di Indonesia.",
  },
  CUAN: {
    kode: "CUAN",
    nama: "Petrindo Jaya Kreasi Tbk",
    type: "STANDARD",
    estimatedWeight: 0.8,
    tier: "MID CAP",
    sector: "Energi",
    rebalanceNotes: "Pertambangan energi dan mineral terintegrasi Prajogo Pangestu.",
  },
  TPIA: {
    kode: "TPIA",
    nama: "Chandra Asri Pacific Tbk",
    type: "STANDARD",
    estimatedWeight: 1.0,
    tier: "MID CAP",
    sector: "Barang Baku",
    rebalanceNotes: "Produsen petrokimia dan infrastruktur terintegrasi terbesar di Indonesia.",
  },
  ISAT: {
    kode: "ISAT",
    nama: "Indosat Tbk",
    type: "STANDARD",
    estimatedWeight: 1.1,
    tier: "MID CAP",
    sector: "Infrastruktur",
    rebalanceNotes: "Pemain telko nomor 2 dengan pertumbuhan ARPU dan sinergi pasca-merger.",
  },
  BRIS: {
    kode: "BRIS",
    nama: "Bank Syariah Indonesia Tbk",
    type: "STANDARD",
    estimatedWeight: 0.9,
    tier: "MID CAP",
    sector: "Keuangan",
    rebalanceNotes: "Bank syariah terbesar di Indonesia dan masuk 10 besar perbankan syariah global.",
  },
  AMRT: {
    kode: "AMRT",
    nama: "Sumber Alfaria Trijaya Tbk",
    type: "STANDARD",
    estimatedWeight: 1.2,
    tier: "CORE LARGE CAP",
    sector: "Barang Konsumen Primer",
    rebalanceNotes: "Jaringan ritel minimarket Alfamart dengan puluhan ribu gerai aktif.",
  },
};

// Rebalancing Schedule for MSCI Indonesia Indices
export const MSCI_REBALANCING_CALENDAR = [
  {
    season: "Februari (QIR)",
    type: "Quarterly Index Review",
    announcement: "12 Februari",
    effective: "28 Februari",
    focus: "Penyesuaian minor jumlah lembar saham, free-float factor, dan saham kapitalisasi ekstrim.",
  },
  {
    season: "Mei (SAIR)",
    type: "Semi-Annual Index Review",
    announcement: "14 Mei",
    effective: "31 Mei",
    focus: "Rebalancing komprehensif 6 bulanan: penambahan / eliminasi konstituen Standard & Small Cap.",
  },
  {
    season: "Agustus (QIR)",
    type: "Quarterly Index Review",
    announcement: "13 Agustus",
    effective: "31 Agustus",
    focus: "Penyesuaian kuartalan bobot saham, FIF update, dan rotasi likuiditas.",
  },
  {
    season: "November (SAIR)",
    type: "Semi-Annual Index Review",
    announcement: "6 November",
    effective: "30 November",
    focus: "Rebalancing komprehensif semester 2: evaluasi batas kapitalisasi pasar dan likuiditas global.",
  },
];

// MSCI Inclusion Criteria (Syarat Masuk Indeks MSCI)
export const MSCI_CRITERIA = [
  {
    id: "full-mcap",
    title: "1. Full Market Capitalization",
    desc: "Kapitalisasi pasar total perusahaan harus memenuhi batas minimal (threshold) pasar berkembang (Emerging Markets), biasanya setara minimal Rp 25-35 triliun untuk Standard Index.",
    icon: "🏢",
  },
  {
    id: "fif",
    title: "2. Free Float Factor (FIF) ≥ 15%",
    desc: "Saham yang beredar di publik (bukan milik pengendali, pemerintah, atau insider) wajib minimal 15% dari total saham disetor untuk memastikan ketersediaan transaksi bebas bagi investor asing.",
    icon: "🔓",
  },
  {
    id: "atvr",
    title: "3. Annualized Traded Value Ratio (ATVR) ≥ 15%",
    desc: "Rasio perputaran nilai transaksi tahunan terhadap free float market cap wajib minimal 15% selama periode 3 bulan dan 12 bulan terakhir untuk menjamin likuiditas tinggi.",
    icon: "💧",
  },
  {
    id: "foreign-room",
    title: "4. Foreign Room & Akses Regulasi",
    desc: "Tidak ada batasan kepemilikan asing (Foreign Ownership Limit) yang terisi penuh, tidak sedang dalam suspensi BEI, dan mematuhi tata kelola emiten global.",
    icon: "🌍",
  },
];

export function getMsciConstituentInfo(kode: string): MsciConstituentMeta {
  const k = kode.toUpperCase();
  if (MSCI_METADATA[k]) return MSCI_METADATA[k];

  const isStandard = MSCI_STANDARD.includes(k);
  const isSmallCap = MSCI_SMALLCAP.includes(k);

  return {
    kode: k,
    nama: `${k} Tbk`,
    type: isStandard ? "STANDARD" : "SMALL_CAP",
    estimatedWeight: isStandard ? 0.8 : 0.2,
    tier: isStandard ? "MID CAP" : "GROWTH SMALL CAP",
    sector: "Umum",
    rebalanceNotes: isStandard ? "Konstituen MSCI Standard Index." : "Konstituen MSCI Small Cap Index.",
  };
}

export function isMsciStock(kode: string): boolean {
  return MSCI_ALL.includes(kode.toUpperCase());
}

export function isMsciStandard(kode: string): boolean {
  return MSCI_STANDARD.includes(kode.toUpperCase());
}

export function isMsciSmallCap(kode: string): boolean {
  return MSCI_SMALLCAP.includes(kode.toUpperCase());
}
