export type ListItem = {
  kode: string;
  nama: string;
  papan: string;
  sektor: string | null;
  harga: number | null;
  quoteAt?: number | null;
  perubahan_pct: number | null;
  mcap: number | null;
  per: number | null;
  pbv: number | null;
  yield_pct: number | null;
  volume: number | null;
  nilai: number | null;
  roe: number | null;
  margin: number | null;
  der: number | null;
  payout: number | null;
  laba_growth: number | null;
  pendapatan_growth: number | null;
  ex_akan: number | null;
  ex_lalu: number | null;
  bayar_akan: number | null;
  bayar_lalu: number | null;
  cmf?: number | null;
  mfi?: number | null;
  foreign_flow?: number | null;
  foreign_status?: "Akumulasi Masif" | "Akumulasi" | "Netral" | "Distribusi" | "Distribusi Masif" | null;
  swing_prob?: number | null;
  swing_tier?: "SUPER" | "HIGH_CONVICTION" | null;
};

export type SectorStat = { nama: string; jumlah: number; perubahan_pct: number | null; naik: number; turun: number; nilai: number };

export type ForeignSummary = {
  netTotal: number;
  buyCount: number;
  sellCount: number;
  sentiment: "Akumulasi Masif" | "Akumulasi" | "Netral" | "Distribusi" | "Distribusi Masif";
};

export type PasarResponse = {
  updatedAt: number;
  sektor: SectorStat[];
  naik: ListItem[];
  turun: ListItem[];
  nilai: ListItem[];
  foreignTopBuy?: ListItem[];
  foreignTopSell?: ListItem[];
  foreignSummary?: ForeignSummary;
};

export type Holder = { nama: string; pct: number | null; posisi: number | null; tanggal: string | null };
export type Kepemilikan = {
  insider_pct: number | null;
  institusi_pct: number | null;
  institusi_float_pct: number | null;
  jumlah_institusi: number | null;
  dana: Holder[];
  bid: number | null;
  ask: number | null;
  bid_size: number | null;
  ask_size: number | null;
};

export type ListResponse = {
  items: ListItem[];
  total: number;
  page: number;
  pages: number;
  updatedAt: number;
};

export type Status = "good" | "warn" | "bad" | "na";

export type Check = {
  label: string;
  value: string;
  status: Status;
  note: string;
  kategori?: string;
};

export type KategoriSkor = { nama: string; skor: number | null; bobot: number; ringkas: string };

export type Analysis = {
  score: number;
  grade: string;
  verdict: string;
  checks: Check[];
  kategori: KategoriSkor[];
};

export type KalenderItem = {
  kode: string;
  nama: string;
  harga: number | null;
  yield_pct: number | null;
  jenis: "pasti" | "perkiraan" | "lalu";
  ex: number;
  bayar: number | null;
};

export type LaporanRow = {
  tanggal: string;
  pendapatan: number | null;
  laba: number | null;
  aset: number | null;
  ekuitas: number | null;
  utang: number | null;
  arus_kas_operasi: number | null;
  fcf: number | null;
  eps: number | null;
};
export type LaporanResponse = { tahunan: LaporanRow[]; kuartalan: LaporanRow[] };

export type DividendYear = { tahun: number; dps: number; yield_pct: number | null };
export type PricePoint = { t: number; c: number };

export type Ihsg = {
  harga: number | null;
  perubahan: number | null;
  perubahan_pct: number | null;
  waktu: number | null;
  seri: number[];
  updatedAt: number;
};

export type StockSplit = {
  tanggal: string;
  rasio: string;
  faktor: number;
};

export type CorporateAction = {
  jenis: "SPLIT" | "RIGHTS_ISSUE" | "DIVIDEN" | "RUPS";
  tanggal: string;
  judul: string;
  keterangan: string;
};

export type NewsSentiment = "BULLISH" | "BEARISH" | "REGULASI_NEGATIF" | "NEUTRAL";

export type NewsItem = {
  id: string;
  judul: string;
  penerbit: string;
  tanggal: string;
  url: string;
  ringkasan?: string;
  sentiment?: NewsSentiment;
  sentimentLabel?: string;
  ringkasanDampak?: string;
  kategori?: "REGULASI" | "KINERJA" | "DIVIDEN" | "AKSI_KORPORASI" | "KOMODITAS" | "UMUM";
};

export type Detail = {
  kode: string;
  nama: string;
  kepemilikan: Kepemilikan;
  sektor: string | null;
  industri: string | null;
  ringkasan: string | null;
  website: string | null;
  karyawan: number | null;

  harga: number | null;
  perubahan: number | null;
  perubahan_pct: number | null;
  quoteStale?: boolean;
  buka: number | null;
  tutup_kemarin: number | null;
  hari_rendah: number | null;
  hari_tinggi: number | null;
  w52_rendah: number | null;
  w52_tinggi: number | null;
  volume: number | null;
  volume_rata: number | null;
  ma50: number | null;
  ma200: number | null;
  beta: number | null;

  mcap: number | null;
  per: number | null;
  per_forward: number | null;
  pbv: number | null;
  eps: number | null;
  bvps: number | null;
  peg: number | null;
  ev: number | null;
  ps: number | null;
  ev_revenue: number | null;

  roe_pct: number | null;
  roa_pct: number | null;
  margin_laba_pct: number | null;
  margin_operasi_pct: number | null;
  margin_kotor_pct: number | null;

  pertumbuhan_pendapatan_pct: number | null;
  pertumbuhan_laba_pct: number | null;
  pertumbuhan_laba_kuartal_pct: number | null;

  pendapatan: number | null;
  kas: number | null;
  utang: number | null;
  der: number | null;
  current_ratio: number | null;
  arus_kas_operasi: number | null;

  yield_pct: number | null;
  dps_12m: number | null;
  payout_pct: number | null;
  tahun_berturut: number;
  cagr_dps_pct: number | null;
  ex_date: string | null;
  dividen_tahunan: DividendYear[];

  target_rata: number | null;
  target_tinggi: number | null;
  target_rendah: number | null;
  rekomendasi: string | null;
  jumlah_analis: number | null;

  saham_beredar: number | null;
  float_saham: number | null;
  insider_pct: number | null;
  institusi_pct: number | null;

  riwayat_harga: PricePoint[];
  splits?: StockSplit[];
  corporate_actions?: CorporateAction[];
  berita?: NewsItem[];
  analisis: Analysis;

  bandarmologi?: BandarmologiData;
  best_buy?: BestBuyData;
  dividend_trap?: DividendTrapData;
};

// ================= BANDARMOLOGI & BEST BUY TYPES =================
export type TopBroker = {
  code: string;
  name: string;
  type: "FOREIGN" | "DOMESTIC";
  lot: number;
  valueRp: number;
  avgPrice: number;
};

export type ForeignFlowDay = {
  date: string; // e.g. "14 Nov 2026"
  dayName: string; // e.g. "Kamis"
  flowRp: number; // e.g. +42_500_000_000
  flowLots: number; // e.g. +125_000
  priceClose: number;
  priceChangePct: number;
  status: "NET_BUY" | "NET_SELL" | "NETRAL";
  mainBroker: string; // e.g. "BK (J.P. Morgan)"
  keterangan: string; // e.g. "Akumulasi Asing Masif"
};

export type BandarmologiData = {
  status: "BIG_ACCUMULATION" | "ACCUMULATION" | "NEUTRAL" | "DISTRIBUTION" | "BIG_DISTRIBUTION";
  statusLabel: string;
  brokerAvgPrice: number;
  topBuyers: TopBroker[];
  topSellers: TopBroker[];
  netForeignValue: number;
  foreignPct: number;
  domesticPct: number;
  retailParticipation: "LOW" | "MEDIUM" | "HIGH";
  timeline?: ForeignFlowDay[];
  summaryFlow5D?: {
    totalNetBuyRp: number;
    daysAccumulation: number;
    daysDistribution: number;
    trendLabel: string;
    lastEntryDate: string;
  };
};

export type BestBuyData = {
  entryLow: number;
  entryHigh: number;
  tp1Price: number;
  tp1Pct: number;
  tp2Price: number;
  tp2Pct: number;
  slPrice: number;
  slPct: number;
  riskRewardRatio: string;
  status: "SIAP_ANTRE" | "WAIT_PULLBACK" | "WAIT_CONFIRM" | "OVERBOUGHT";
  statusLabel: string;
  statusDesc: string;
  statusBadge: string;
  rationale: string[];
};

export type DividendTrapData = {
  hasDividend: boolean;
  yieldPct: number | null;
  dps: number | null;
  payoutPct: number | null;
  consecutiveYears: number;
  trapScore: number;
  riskLevel: "RENDAH" | "MODERAT" | "TINGGI";
  riskColor: string;
  reboundExpectation: string;
  estimatedExDropPct: number;
  advice: string;
  timeline: {
    cumDate: string | null;
    exDate: string | null;
    recordingDate: string | null;
    paymentDate: string | null;
  };
};

// ================= CRYPTO TYPES =================
export type CryptoCategory =
  | "Semua"
  | "Layer 1"
  | "Layer 2"
  | "DeFi"
  | "AI & Big Data"
  | "Meme"
  | "Infrastructure"
  | "Stablecoin"
  | "Payments"
  | "Interoperability"
  | "Lainnya";

export type CryptoItem = {
  rank: number | null;
  symbol: string;
  name: string;
  category: CryptoCategory;
  price_usd: number;
  price_idr: number;
  change_24h: number | null;
  change_7d: number | null;
  high_24h_usd: number | null;
  low_24h_usd: number | null;
  high_24h_idr: number | null;
  low_24h_idr: number | null;
  volume_24h_usd: number | null;
  volume_24h_idr: number | null;
  market_cap_usd: number | null;
  market_cap_idr: number | null;
  circulating_supply: number | null;
  max_supply: number | null;
  ath_usd: number | null;
  ath_date: string | null;
  atl_usd: number | null;
  atl_date: string | null;
  ath_change_pct: number | null;
  sparkline: number[];
  icon_url: string;
  quoteSource: "Binance Spot" | "Yahoo Finance";
  quoteCurrency: "USDT" | "USD";
  observedAt: number | null;
  stale: boolean;
};

export type CryptoRecommendation = {
  signal: "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL";
  score: number; // 0 - 100
  summary: string;
  indicators: {
    rsi14: { value: number; status: "Oversold" | "Neutral" | "Overbought"; signal: "Buy" | "Neutral" | "Sell" };
    macd: { signal: "Bullish" | "Neutral" | "Bearish"; note: string };
    maTrend: { signal: "Bullish" | "Neutral" | "Bearish"; aboveEma20: boolean; aboveEma50: boolean; aboveEma200: boolean };
    volatility30d: { value: number; status: "Rendah" | "Sedang" | "Tinggi" };
    fearGreed: CryptoFearGreed;
  };
  pros: string[];
  risks: string[];
};

export type CryptoFearGreed = {
  value: number | null;
  sentiment: string;
  observedAt: number | null;
  stale: boolean;
};

export type CryptoHistoricalPoint = {
  t: number; // timestamp ms
  p_usd: number;
  p_idr: number;
};

export type CryptoMilestone = {
  year: string;
  title: string;
  description: string;
};

export type CryptoDetailData = CryptoItem & {
  description: string;
  consensus: string;
  website_url?: string;
  whitepaper_url?: string;
  cmc_url?: string;
  explorer_url?: string;
  github_url?: string;
  milestones?: CryptoMilestone[];
  recommendation: CryptoRecommendation | null;
  history: CryptoHistoricalPoint[];
  returnSimulations: {
    period: string; // "1 Bulan Lalu" | "6 Bulan Lalu" | "1 Tahun Lalu" | "2 Tahun Lalu" | "3 Tahun Lalu" | "5 Tahun Lalu"
    initialPriceUsd: number;
    initialPriceIdr: number;
    roiPct: number;
    isAvailable?: boolean;
    note?: string;
  }[];
};

