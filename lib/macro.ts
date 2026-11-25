import YahooFinance from "yahoo-finance2";
import { fetchNewsFeed, type SourcedNews } from "./news";
import { marketDay, MARKET_DAY_MS } from "./marketDate";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface MacroIndicator {
  symbol: string;
  name: string;
  category: "currency" | "yield" | "index" | "commodity";
  price: number | null;
  change: number | null;
  changePct: number | null;
  observedAt: number | null;
  status: "observed" | "stale" | "unavailable";
  unit: string;
  direction: "up" | "down" | "neutral";
  ihsgImpact: "BULLISH" | "BEARISH" | "NEUTRAL";
  impactBadge: string;
  penjelasan: string;
  bagaimanaPengaruhnya: string;
  sektorTerkait: string[];
}

export interface MacroEvent {
  id: string;
  title: string;
  date: string; // ISO date format YYYY-MM-DD
  timeWib?: string;
  category: "MSCI" | "THE_FED" | "CPI_US" | "BI_RATE" | "INFLASI_ID";
  impact: "HIGH" | "MEDIUM";
  badge: string;
  source: string;
  countdownDays: number;
  description: string;
  pengaruhKeIhsg: string;
  sektorTerdampak: string[];
  tipsAksiTrader: string;
  flag?: string;
  currency?: string;
  sahamPilihan?: string[];
}

export interface MacroNewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: number;
  link: string;
  category: "global" | "domestic";
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  tag: string;
}

export interface MacroResponse {
  updatedAt: string;
  indicators: MacroIndicator[];
  upcomingEvents: MacroEvent[];
  news: MacroNewsItem[];
  cheatSheet: {
    factor: string;
    skenarioNaik: { aksi: string; dampakIhsg: string; sektorDiuntungkan: string[]; sektorTertekan: string[] };
    skenarioTurun: { aksi: string; dampakIhsg: string; sektorDiuntungkan: string[]; sektorTertekan: string[] };
  }[];
}

// In-memory cache for macro data (10-minute TTL to prevent API flooding)
let cachedMacro: { at: number; data: MacroResponse } | null = null;
const MACRO_CACHE_TTL = 10 * 60 * 1000;

export async function getMacroData(force = false): Promise<MacroResponse> {
  const now = Date.now();
  if (!force && cachedMacro && now - cachedMacro.at < MACRO_CACHE_TTL) {
    return cachedMacro.data;
  }

  const [indicators, news] = await Promise.all([fetchLiveIndicators(), fetchMacroNews()]);

  // 2. Compute calendar events relative to current date
  const upcomingEvents = getUpcomingEvents();

  // 4. Cheat-sheet matrix for macro correlations
  const cheatSheet = getMacroCheatSheet();

  const response: MacroResponse = {
    updatedAt: new Date().toISOString(),
    indicators,
    upcomingEvents,
    news,
    cheatSheet,
  };

  cachedMacro = { at: now, data: response };
  return response;
}

async function fetchLiveIndicators(): Promise<MacroIndicator[]> {
  const symbols = [
    { s: "IDR=X", name: "Kurs USD / IDR", cat: "currency" as const, unit: "Rp" },
    { s: "^TNX", name: "Yield Obligasi US 10-Year", cat: "yield" as const, unit: "%" },
    { s: "DX-Y.NYB", name: "US Dollar Index (DXY)", cat: "index" as const, unit: "Poin" },
    { s: "^JKSE", name: "IHSG Composite", cat: "index" as const, unit: "Poin" },
    { s: "CL=F", name: "Minyak Mentah WTI", cat: "commodity" as const, unit: "USD/bbl" },
    { s: "GC=F", name: "Emas Dunia (Gold)", cat: "commodity" as const, unit: "USD/oz" },
  ];

  const quotes = await Promise.all(symbols.map(({ s }) =>
    yf.quote(s, {}, { validateResult: false, fetchOptions: { signal: AbortSignal.timeout(4000) } }).catch(() => null),
  ));

  return symbols.map(({ s, name, cat, unit }, i): MacroIndicator => {
    const q = quotes[i];
    const price = q?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price)) {
      const previous = cachedMacro?.data.indicators.find((indicator) => indicator.symbol === s && indicator.price !== null);
      if (previous) return { ...previous, status: "stale" };
      return {
        ...buildIndicatorDetails(s, name, cat, unit, 0, 0, 0, "neutral"),
        price: null, change: null, changePct: null, observedAt: null, status: "unavailable",
        ihsgImpact: "NEUTRAL",
        impactBadge: "Data tidak tersedia",
        bagaimanaPengaruhnya: "Dampak terkini belum dapat dinilai tanpa data dari penyedia.",
      };
    }

    const change = q.regularMarketChange ?? null;
    const changePct = q.regularMarketChangePercent ?? null;
    const time = q.regularMarketTime instanceof Date ? q.regularMarketTime.getTime() : NaN;
    const observedAt = Number.isFinite(time) && time > 0 ? time : null;
    const direction = changePct === null ? "neutral" : changePct > 0.05 ? "up" : changePct < -0.05 ? "down" : "neutral";
    const details = buildIndicatorDetails(s, name, cat, unit, price, change ?? 0, changePct ?? 0, direction);
    if (changePct === null) {
      details.ihsgImpact = "NEUTRAL";
      details.impactBadge = "Perubahan belum tersedia";
      details.bagaimanaPengaruhnya = "Persentase perubahan belum tersedia untuk menilai dampak pergerakan.";
    }
    return { ...details, change, changePct, observedAt, status: "observed" };
  });
}

function buildIndicatorDetails(
  symbol: string,
  name: string,
  category: "currency" | "yield" | "index" | "commodity",
  unit: string,
  price: number,
  change: number,
  changePct: number,
  direction: "up" | "down" | "neutral"
): Omit<MacroIndicator, "observedAt" | "status"> {
  let ihsgImpact: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let impactBadge = "🟡 Netral";
  let penjelasan = "";
  let bagaimanaPengaruhnya = "";
  let sektorTerkait: string[] = [];

  switch (symbol) {
    case "IDR=X":
      penjelasan = "Nilai tukar 1 Dolar Amerika Serikat terhadap Rupiah Indonesia.";
      sektorTerkait = ["Perbankan (Big Banks)", "Konsumer Impor", "Farmasi", "Energi Ekspor"];
      if (changePct > 0.2) {
        ihsgImpact = "BEARISH";
        impactBadge = "🔴 Rupiah Melemah (Tekanan Outflow)";
        bagaimanaPengaruhnya =
          "Pelemahan Rupiah membuat aset berbasis Rupiah kurang menarik bagi pengelola dana global (investor asing), memicu penjualan bersih (net sell) pada saham big caps IHSG (BBCA, BBRI, BMRI, BBNI), dan menaikkan beban utang valas emiten.";
      } else if (changePct < -0.2) {
        ihsgImpact = "BULLISH";
        impactBadge = "🟢 Rupiah Menguat (Katalis Inflow)";
        bagaimanaPengaruhnya =
          "Penguatan Rupiah meningkatkan daya tarik investasi pasar modal domestik, memicu inflow modal asing ke saham LQ45 & MSCI, serta menekan biaya impor bahan baku emiten konsumer dan farmasi.";
      } else {
        impactBadge = "🟢 Rupiah Stabil";
        bagaimanaPengaruhnya = "Nilai tukar relatif stabil memberi kenyamanan bagi investor institusi untuk mengakumulasi saham.";
      }
      break;

    case "^TNX":
      penjelasan = "Tingkat imbal hasil surat utang pemerintah AS (US Treasury) bertenor 10 tahun (acuan suku bunga bebas risiko global).";
      sektorTerkait = ["Properti & Real Estate", "Teknologi", "Perbankan", "Infrastruktur"];
      if (changePct > 1.0 || price > 4.5) {
        ihsgImpact = "BEARISH";
        impactBadge = "🔴 Yield AS Naik (Beban IHSG)";
        bagaimanaPengaruhnya =
          "Kenaikan yield obligasi AS mencerminkan ekspektasi suku bunga The Fed tetap tinggi (hawkish). Investor global lebih memilih instrumen berimbal hasil dolar bebas risiko dibanding saham emerging markets, menekan likuiditas IHSG.";
      } else if (changePct < -1.0) {
        ihsgImpact = "BULLISH";
        impactBadge = "🟢 Yield AS Turun (Likuiditas Longgar)";
        bagaimanaPengaruhnya =
          "Penurunan yield AS menandakan ekspektasi pemangkasan bunga The Fed (dovish). Likuiditas global melonggar, memperlebar selisih yield dengan SBN Indonesia, dan menjadi dorongan kuat bagi saham properti (CTRA, BSDE) & bank.";
      } else {
        impactBadge = "🟡 Yield AS Moderat";
        bagaimanaPengaruhnya = "Pergerakan yield obligasi AS berada di rentang wajar dan tidak memicu guncangan volatilitas besar.";
      }
      break;

    case "DX-Y.NYB":
      penjelasan = "Indeks Dolar AS yang mengukur keperkasaan mata uang USD terhadap 6 mata uang utama dunia.";
      sektorTerkait = ["Seluruh Sektor IHSG", "Komoditas", "Saham Berbobot MSCI"];
      if (changePct > 0.3) {
        ihsgImpact = "BEARISH";
        impactBadge = "🔴 Dolar Perkasa (Tekanan Emerging Markets)";
        bagaimanaPengaruhnya =
          "DXY memiliki korelasi terbalik dengan bursa negara berkembang. Saat Dolar menguat tajam, dana global ditarik kembali ke pasar AS sehingga pasar modal Asia & IHSG cenderung mengalami koreksi.";
      } else if (changePct < -0.3) {
        ihsgImpact = "BULLISH";
        impactBadge = "🟢 Dolar Melandai (Sentimen Positif IHSG)";
        bagaimanaPengaruhnya =
          "Pelemahan DXY membuka ruang bagi mata uang Asia dan IHSG untuk bergerak naik seiring kembalinya selera risiko (risk-on) investor global.";
      } else {
        impactBadge = "🟡 DXY Konsolidasi";
        bagaimanaPengaruhnya = "Indeks dolar berada dalam fase sideways.";
      }
      break;

    case "CL=F":
      penjelasan = "Harga minyak mentah dunia jenis West Texas Intermediate (WTI) per barel.";
      sektorTerkait = ["Minyak & Gas (MEDC, ENRG)", "Petrokimia (TPIA)", "Transportasi", "APBN"];
      if (changePct > 2.0) {
        ihsgImpact = "NEUTRAL";
        impactBadge = "🟡 Reli Minyak (Cuan Migas vs Beban Inflasi)";
        bagaimanaPengaruhnya =
          "Kenaikan minyak menjadi sentimen bullish instan bagi saham emiten energi (MEDC, ENRG, PGAS), namun jika berlangsung lama dapat membebani subsidi energi APBN dan menaikkan inflasi.";
      } else if (changePct < -2.0) {
        ihsgImpact = "BULLISH";
        impactBadge = "🟢 Minyak Turun (Meredakan Inflasi)";
        bagaimanaPengaruhnya =
          "Harga minyak yang melandai menurunkan tekanan inflasi energi dan beban impor migas nasional, menguntungkan sektor transportasi dan manufaktur.";
      } else {
        impactBadge = "🟡 Minyak Stabil";
        bagaimanaPengaruhnya = "Harga minyak bergerak stabil di level seimbang.";
      }
      break;

    case "GC=F":
      penjelasan = "Harga emas murni internasional per troy ounce.";
      sektorTerkait = ["Tambang Emas (MDKA, ANTM, BRMS, PSAB)", "Safe Haven"];
      if (changePct > 0.5) {
        ihsgImpact = "NEUTRAL";
        impactBadge = "🟢 Emas Menguat (Katalis Saham Tambang Emas)";
        bagaimanaPengaruhnya =
          "Penguatan harga emas dunia langsung mengangkat margin laba emiten tambang emas seperti MDKA, ANTM, BRMS, dan PSAB, meskipun terkadang mencerminkan ketidakpastian geopolitik global.";
      } else {
        impactBadge = "🟡 Emas Normal";
        bagaimanaPengaruhnya = "Harga emas stabil, pergerakan saham emas dipengaruhi volume produksi masing-masing emiten.";
      }
      break;

    case "^JKSE":
      penjelasan = "Indeks Harga Saham Gabungan (IHSG) Bursa Efek Indonesia.";
      sektorTerkait = ["Indeks Utama"];
      ihsgImpact = changePct >= 0 ? "BULLISH" : "BEARISH";
      impactBadge = changePct >= 0 ? "🟢 IHSG Menghijau" : "🔴 IHSG Melemah";
      bagaimanaPengaruhnya = "Mencerminkan rata-rata tertimbang pergerakan seluruh saham yang tercatat di Bursa Efek Indonesia.";
      break;
  }

  return {
    symbol,
    name,
    category,
    price,
    change,
    changePct,
    unit,
    direction,
    ihsgImpact,
    impactBadge,
    penjelasan,
    bagaimanaPengaruhnya,
    sektorTerkait,
  };
}

function getUpcomingEvents(): MacroEvent[] {
  const today = marketDay(Date.now());

  const allEvents: Omit<MacroEvent, "countdownDays">[] = [
    {
      id: "bi_rdg_nov_2026",
      title: "Rapat Dewan Gubernur Bank Indonesia (BI-Rate)",
      date: "2026-11-20",
      timeWib: "14:00 WIB",
      category: "BI_RATE",
      impact: "HIGH",
      flag: "🇮🇩",
      currency: "IDR",
      sahamPilihan: ["BBCA", "BBRI", "BSDE"],
      badge: "🇮🇩 Suku Bunga Domestik",
      source: "Bank Indonesia",
      description: "Keputusan suku bunga acuan BI-Rate dan asesmen stabilitas moneter serta transmisi likuiditas perbankan.",
      pengaruhKeIhsg:
        "Suku bunga BI yang tetap atau turun mendukung pertumbuhan kredit perbankan nasional, menurunkan biaya dana (Cost of Funds), dan menjaga margin laba emiten perbankan & properti.",
      sektorTerdampak: ["Perbankan (BBCA, BBRI, BMRI)", "Properti (BSDE, CTRA)", "Otomotif (ASII)"],
      tipsAksiTrader: "Sektor properti dan bank sensitif suku bunga biasanya mengalami kenaikan jika BI memberi sinyal pelonggaran likuiditas.",
    },
    {
      id: "us_pce_fomc_nov_2026",
      title: "US Core PCE & FOMC Minutes",
      date: "2026-11-21",
      timeWib: "20:30 WIB",
      category: "CPI_US",
      impact: "HIGH",
      flag: "🇺🇸",
      currency: "USD",
      sahamPilihan: ["TLKM", "ASII"],
      badge: "📊 Inflasi Pengeluaran AS",
      source: "US Bureau of Economic Analysis",
      description: "Ukuran inflasi favorit The Fed (Core PCE Price Index) beserta risalah pertemuan rapat dewan gubernur The Fed.",
      pengaruhKeIhsg:
        "Jika inflasi inti PCE melandai di bawah konsensus, ekspektasi pemangkasan suku bunga menguat, menekan indeks Dolar AS dan memicu inflow dana asing ke bursa negara berkembang.",
      sektorTerdampak: ["Big Cap Asing", "Telekomunikasi (TLKM)", "Konglomerasi (ASII)"],
      tipsAksiTrader: "Amati pergerakan Dolar AS dan yield Treasury 10-tahun pasca rilis; konfirmasi sinyal rebound untuk emiten berkapitalisasi besar.",
    },
    {
      id: "idx_lq45_eval_nov_2026",
      title: "Evaluasi Mayor Indeks LQ45 & IDX30",
      date: "2026-11-26",
      timeWib: "16:00 WIB",
      category: "MSCI",
      impact: "HIGH",
      flag: "🇮🇩",
      currency: "IDX",
      sahamPilihan: ["ACES", "MAPI"],
      badge: "🏛 Evaluasi Mayor BEI",
      source: "Bursa Efek Indonesia",
      description: "Penyesuaian konstituen indeks paling likuid di BEI (LQ45 & IDX30) berdasarkan kriteria nilai transaksi, kapitalisasi pasar free-float, dan rasio keuangan.",
      pengaruhKeIhsg:
        "Emiten yang berhasil masuk ke indeks LQ45/IDX30 menjadi aset yang wajib dibeli oleh reksa dana indeks dan dana pensiun domestik, menciptakan lonjakan volume beli terarah.",
      sektorTerdampak: ["Konsumer Ritel (ACES, MAPI)", "Kandidat Inclusion LQ45"],
      tipsAksiTrader: "Akumulasi bertahap emiten yang masuk dalam radar inclusion sebelum tanggal efektif penyesuaian bobot manajer investasi.",
    },
    {
      id: "china_pmi_nov_2026",
      title: "China Caixin Manufacturing PMI",
      date: "2026-11-28",
      timeWib: "08:45 WIB",
      category: "INFLASI_ID",
      impact: "MEDIUM",
      flag: "🇨🇳",
      currency: "CNY",
      sahamPilihan: ["ADRO", "MBMA"],
      badge: "🏭 Aktivitas Manufaktur Global",
      source: "Caixin & S&P Global",
      description: "Indeks aktivitas pabrik dan manufaktur Tiongkok sebagai mitra dagang dan konsumen komoditas terbesar Indonesia.",
      pengaruhKeIhsg:
        "PMI Tiongkok di atas level 50 (zona ekspansi) mencerminkan percepatan industri dan permintaan tinggi terhadap komoditas batubara, nikel, dan tembaga dari Indonesia.",
      sektorTerdampak: ["Energi Batubara (ADRO)", "Nikel & Logam (MBMA, INCO)"],
      tipsAksiTrader: "Momentum trading saham tambang komoditas dapat dimanfaatkan jika angka PMI manufaktur mengonfirmasi pemulihan pabrik China.",
    },
    {
      id: "msci_effective_nov_2026",
      title: "Efektif Rebalancing MSCI Semi-Annual",
      date: "2026-11-30",
      timeWib: "15:50 WIB (Sesi Pre-Closing)",
      category: "MSCI",
      impact: "HIGH",
      flag: "🌍",
      currency: "MSCI",
      sahamPilihan: ["AMMN", "BRMS"],
      badge: "🌍 Eksekusi Dana Pasif Global",
      source: "MSCI Inc.",
      description: "Hari perdagangan terakhir penyesuaian portofolio indeks MSCI. Dana pasif ETF global (seperti iShares MSCI Indonesia / EIDO) wajib mengeksekusi penyesuaian saham di BEI.",
      pengaruhKeIhsg:
        "Pada sesi pre-closing (15:50 - 16:00 WIB), volume transaksi IHSG meledak drastis dengan nilai transaksi triliunan rupiah. Saham inclusion menyerap pembelian masif.",
      sektorTerdampak: ["Konstituen MSCI Standard (AMMN, BRMS)", "Saham Big Cap IHSG"],
      tipsAksiTrader: "Bagi yang memegang saham inclusion, sesi pre-closing hari ini adalah waktu emas untuk Take Profit ke dana pasif dengan likuiditas melimpah tanpa menekan harga.",
    },
    {
      id: "the_fed_fomc_dec_2026",
      title: "Rapat Bunga The Fed (FOMC Rate & Dot Plot)",
      date: "2026-12-10",
      timeWib: "02:00 WIB (Dini Hari)",
      category: "THE_FED",
      impact: "HIGH",
      flag: "🇺🇸",
      currency: "USD",
      sahamPilihan: ["BMRI", "BBNI"],
      badge: "🏛️ Kebijakan Moneter Dunia",
      source: "Federal Reserve (AS)",
      description: "Penetapan suku bunga Fed Funds Rate, proyeksi ekonomi (Dot Plot), dan pidato Jerome Powell.",
      pengaruhKeIhsg:
        "Menjadi event penentu arah likuiditas pasar modal dunia menjelang akhir tahun (Santa Claus Rally). Pernyataan dovish The Fed sering menjadi pemicu rally tahunan di IHSG.",
      sektorTerdampak: ["Seluruh Pasar IHSG", "Perbankan Big Cap (BMRI, BBNI)", "SBN & Obligasi"],
      tipsAksiTrader: "Pantau rilis Dot Plot untuk mengukur berapa kali pemangkasan bunga yang direncanakan The Fed di tahun mendatang.",
    },
    {
      id: "cpi_us_dec_2026",
      title: "Rilis Inflasi US CPI (Desember)",
      date: "2026-12-11",
      timeWib: "20:30 WIB",
      category: "CPI_US",
      impact: "HIGH",
      flag: "🇺🇸",
      currency: "USD",
      sahamPilihan: ["BBCA", "TLKM"],
      badge: "📊 Data Inflasi AS",
      source: "BLS AS",
      description: "Data inflasi konsumen AS menjelang pergantian tahun.",
      pengaruhKeIhsg: "Konfirmasi keberlanjutan tren disinflasi AS.",
      sektorTerdampak: ["Perbankan", "Komoditas", "Teknologi"],
      tipsAksiTrader: "Gunakan untuk mengonfirmasi arah tren dolar AS.",
    },
  ];

  return allEvents
    .map((e) => {
      const countdownDays = (Date.parse(e.date + "T00:00:00Z") - today) / MARKET_DAY_MS;
      return { ...e, countdownDays };
    })
    .filter((e) => e.countdownDays >= -1)
    .sort((a, b) => a.countdownDays - b.countdownDays);
}

async function fetchMacroNews(): Promise<MacroNewsItem[]> {
  const [domestic, global] = await Promise.all([
    fetchNewsFeed('IHSG OR "Bank Indonesia" OR "MSCI Indonesia" OR "Bursa Efek Indonesia"'),
    fetchNewsFeed('"Federal Reserve" OR "US CPI" OR "Treasury yield" OR "MSCI"', "en"),
  ]);
  const map = (articles: SourcedNews[], category: MacroNewsItem["category"]): MacroNewsItem[] =>
    articles.slice(0, 7).map((article) => ({
      id: article.url,
      title: article.judul,
      source: article.penerbit,
      publishedAt: article.publishedAt,
      link: article.url,
      category,
      sentiment: article.sentiment === "REGULASI_NEGATIF" ? "BEARISH" : article.sentiment ?? "NEUTRAL",
      tag: category === "domestic" ? "Domestik / IHSG" : "Makro Global",
    }));

  const unique = new Map<string, MacroNewsItem>();
  for (const article of [...map(domestic, "domestic"), ...map(global, "global")]) {
    unique.set(article.id, article);
  }
  return [...unique.values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

function getMacroCheatSheet() {
  return [
    {
      factor: "Inflasi US CPI (Consumer Price Index)",
      skenarioNaik: {
        aksi: "CPI Naik Lebih Tinggi dari Konsensus (Inflasi AS Panas)",
        dampakIhsg: "BEARISH: The Fed menunda pemangkasan bunga (higher-for-longer). DXY menguat, Rupiah tertekan, asing net sell di IHSG.",
        sektorDiuntungkan: ["Komoditas Energi (Minyak)", "Emas"],
        sektorTertekan: ["Perbankan (BBCA, BBRI)", "Properti", "Teknologi"],
      },
      skenarioTurun: {
        aksi: "CPI Melandai / Di Bawah Estimasi (Disinflasi Berlanjut)",
        dampakIhsg: "BULLISH KUAT: The Fed leluasa memangkas suku bunga (dovish). Dolar AS melemah, dana asing mengalir deras ke bursa emerging markets.",
        sektorDiuntungkan: ["Properti (CTRA, BSDE, SMRA)", "Perbankan Big Cap", "Konsumer Siklikal"],
        sektorTertekan: ["Sektor Defensif Kas"],
      },
    },
    {
      factor: "Suku Bunga The Fed (Fed Funds Rate)",
      skenarioNaik: {
        aksi: "The Fed Hawkish / Menahan Bunga Tinggi",
        dampakIhsg: "BEARISH: Biaya modal global mahal, valuasi saham terdiskon, spread bunga dengan SBN mengecil.",
        sektorDiuntungkan: ["Eksportir Murni berbasis Dolar"],
        sektorTertekan: ["Emiten dengan Utang Dolar Tinggi", "Start-up & Tech"],
      },
      skenarioTurun: {
        aksi: "The Fed Pangkas Suku Bunga (Rate Cut)",
        dampakIhsg: "BULLISH BESAR: Likuiditas pasar modal global melimpah, bunga pinjaman turun, laba emiten bertumbuh pesat.",
        sektorDiuntungkan: ["Properti", "Perbankan", "Otomotif", "Infrastruktur"],
        sektorTertekan: ["Reksadana Pasar Uang Dolar"],
      },
    },
    {
      factor: "Nilai Tukar Rupiah (USD / IDR)",
      skenarioNaik: {
        aksi: "USD/IDR Naik (Rupiah Melemah Tajam)",
        dampakIhsg: "BEARISH: Investor asing merealisasikan profit dalam dolar untuk hindari rugi kurs, harga bahan baku impor melonjak.",
        sektorDiuntungkan: ["Tambang Batubara & Logam (ADRO, PTBA, ANTM)", "CPO (AALI)"],
        sektorTertekan: ["Farmasi (KLBF)", "Konsumer Impor (ICBP, INDF)", "Penerbangan"],
      },
      skenarioTurun: {
        aksi: "USD/IDR Turun (Rupiah Menguat Kokoh)",
        dampakIhsg: "BULLISH: Confidence investor asing tinggi, margin laba emiten konsumer meningkat, IHSG terangkat.",
        sektorDiuntungkan: ["Big Banks", "Konsumer Primer (UNVR, ICBP)", "Ritel (ACES, MAPI)"],
        sektorTertekan: ["Eksportir Margin Tipis"],
      },
    },
    {
      factor: "Rebalancing Indeks MSCI Indonesia",
      skenarioNaik: {
        aksi: "Saham Masuk (Inclusion) ke MSCI Standard / Small Cap",
        dampakIhsg: "BULLISH KHUSUS EMITEN: ETF global dan manajer investasi pasif wajib membeli saham tersebut, menghasilkan inflow ratusan miliar rupiah.",
        sektorDiuntungkan: ["Saham Terpilih MSCI Inclusion"],
        sektorTertekan: ["-"],
      },
      skenarioTurun: {
        aksi: "Saham Keluar (Exclusion) atau Bobot Indonesia Diturunkan",
        dampakIhsg: "BEARISH KHUSUS EMITEN: Terjadi outflow otomatis dana pasif pada tanggal efektif penutupan bursa.",
        sektorDiuntungkan: ["-"],
        sektorTertekan: ["Saham Terpilih MSCI Exclusion"],
      },
    },
  ];
}
