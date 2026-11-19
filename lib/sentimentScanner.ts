import type { NewsSentiment } from "./types";
import { classifyNewsSentiment } from "./news";

export interface ScannedPick {
  kode: string;
  nama: string;
  action: "BUY_ON_WEAKNESS" | "MOMENTUM_BUY" | "BEST_BUY" | "WAIT_AND_SEE";
  actionLabel: string;
  actionBadgeColor: string;
  targetReboundPct: string;
  rationale: string;
  keyCatalyst: string;
  fallbackPrice: number;
  fallbackChangePct: number;
}

export interface DynamicCatalystGroup {
  id: string;
  category: "EMAS" | "BUNGA" | "DIVIDEN" | "REGULASI" | "ENERGI";
  categoryLabel: string;
  categoryIcon: string;
  badge: string;
  badgeColor: string;
  convictionScore: number;
  headline: string;
  source: string;
  timeAgo: string;
  catalystSummary: string;
  recommendedPicks: ScannedPick[];
  isLiveScanned: boolean;
}

interface RawNewsFeedItem {
  title: string;
  source: string;
  link: string;
  pubDate: Date;
}

let cachedCatalysts: { timestamp: number; data: DynamicCatalystGroup[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// Curated stock pick knowledge matrix mapped to theme
const THEME_PICKS_CATALOG: Record<
  "EMAS" | "BUNGA" | "DIVIDEN" | "REGULASI" | "ENERGI",
  {
    categoryLabel: string;
    categoryIcon: string;
    badge: string;
    badgeColor: string;
    defaultScore: number;
    defaultSummary: string;
    picks: ScannedPick[];
  }
> = {
  EMAS: {
    categoryLabel: "Reli Emas Dunia ATH",
    categoryIcon: "🪙",
    badge: "🟢 SANGAT BULLISH (Katalis Emas)",
    badgeColor: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-300",
    defaultScore: 94,
    defaultSummary:
      "Sentimen lindung nilai (safe haven) global dan akumulasi cadangan devisa emas oleh bank sentral mengerek harga komoditas emas ke rekor baru. Emiten penambang emas menikmati pelebaran margin laba bersih langsung.",
    picks: [
      {
        kode: "BRMS",
        nama: "Bumi Resources Minerals Tbk",
        action: "MOMENTUM_BUY",
        actionLabel: "Momentum Breakout ATH",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+3.5% s/d +6.0%",
        rationale: "Pengoperasian pabrik emas kedua melipatgandakan volume produksi emas batangan di tengah rekor harga jual.",
        keyCatalyst: "Kapasitas produksi naik + rekor harga emas dunia",
        fallbackPrice: 426,
        fallbackChangePct: 4.4,
      },
      {
        kode: "MDKA",
        nama: "Merdeka Copper Gold Tbk",
        action: "BEST_BUY",
        actionLabel: "Best Buy Zone Support",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+2.8% s/d +5.5%",
        rationale: "Valuasi PBV terkoreksi ke zona diskon historis; katalis percepatan tambang emas raksasa Pani Gold Project.",
        keyCatalyst: "Diskon support teknikal + ekspansi proyek emas Pani",
        fallbackPrice: 2450,
        fallbackChangePct: 2.8,
      },
      {
        kode: "PSAB",
        nama: "J Resources Asia Pasifik Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Buy on Weakness",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+3.0% s/d +5.0%",
        rationale: "Beta tinggi terhadap pergerakan harga emas spot internasional dengan akumulasi stabil broker institusi.",
        keyCatalyst: "Sensitivitas tinggi terhadap pergerakan emas spot",
        fallbackPrice: 318,
        fallbackChangePct: 3.2,
      },
    ],
  },
  BUNGA: {
    categoryLabel: "Pelonggaran Bunga BI & The Fed",
    categoryIcon: "🏦",
    badge: "🟢 AKUMULASI ASING (Inflow Masif)",
    badgeColor: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    defaultScore: 91,
    defaultSummary:
      "Tren disinflasi membuka jalan bagi penurunan BI-Rate dan Fed Funds Rate. Beban bunga simpanan perbankan menurun drastis sehingga Net Interest Margin (NIM) terdongkrak, memicu inflow ratusan miliar dari manajer investasi asing.",
    picks: [
      {
        kode: "BBCA",
        nama: "Bank Central Asia Tbk",
        action: "BEST_BUY",
        actionLabel: "Akumulasi Asing Konsisten",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+1.5% s/d +3.0%",
        rationale: "Rasio dana murah (CASA >80%) terkuat di Asia Tenggara, NPL terendah, dan menjadi jangkar utama indeks MSCI.",
        keyCatalyst: "Inflow pasif asing + biaya dana murah terendah",
        fallbackPrice: 10250,
        fallbackChangePct: 1.2,
      },
      {
        kode: "BBRI",
        nama: "Bank Rakyat Indonesia Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Rebound Diskon PBV",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+2.0% s/d +4.0%",
        rationale: "Valuasi PBV berada di deviasi bawah rata-rata 3 tahun; segmen mikro pulih didukung yield dividen kas >6%.",
        keyCatalyst: "Diskon valuasi PBV + dividend yield kas atraktif",
        fallbackPrice: 4760,
        fallbackChangePct: 2.3,
      },
      {
        kode: "BMRI",
        nama: "Bank Mandiri (Persero) Tbk",
        action: "MOMENTUM_BUY",
        actionLabel: "Momentum Kredit Korporasi",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+1.8% s/d +3.5%",
        rationale: "Pertumbuhan kredit korporasi & sindikasi industri terdepan dengan rasio efisiensi operasional solid.",
        keyCatalyst: "Pertumbuhan laba bersih & kredit korporasi melesat",
        fallbackPrice: 6850,
        fallbackChangePct: 1.8,
      },
    ],
  },
  DIVIDEN: {
    categoryLabel: "Dividen Kas Jumbo Q4",
    categoryIcon: "💰",
    badge: "🟢 DIVIDEN HUNTER (Yield 8-12%)",
    badgeColor: "border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-700/50 dark:bg-purple-950/40 dark:text-purple-300",
    defaultScore: 88,
    defaultSummary:
      "Arus kas operasional bebas (Free Cash Flow) emiten terbukti surplus tebal sepanjang tahun berjalan. Pengumuman cum date dividen interim menjadi magnet penggerak akumulasi bagi investor pemburu yield kas tunai.",
    picks: [
      {
        kode: "ADRO",
        nama: "Alamtri Resources Indonesia Tbk",
        action: "BEST_BUY",
        actionLabel: "Dividen Kas Jumbo",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+2.5% s/d +5.0%",
        rationale: "Pembagian dividen interim bernilai jumbo diiringi aksi korporasi strategis spin-off pilar batubara termal.",
        keyCatalyst: "Yield dividen kas interim tinggi + restrukturisasi",
        fallbackPrice: 3780,
        fallbackChangePct: 2.5,
      },
      {
        kode: "ITMG",
        nama: "Indo Tambangraya Megah Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Cash Cow Dividen >70%",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+2.0% s/d +4.5%",
        rationale: "Rekam jejak konsistensi pembagian dividen kas tertinggi di BEI tanpa beban utang berbunga.",
        keyCatalyst: "Saldo kas tebal tanpa utang + payout konsisten",
        fallbackPrice: 26500,
        fallbackChangePct: 1.5,
      },
      {
        kode: "PTBA",
        nama: "Bukit Asam Tbk",
        action: "BEST_BUY",
        actionLabel: "Dividen Aristokrat BUMN",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+1.8% s/d +3.8%",
        rationale: "Riwayat setoran dividen 100% laba bersih ke kas negara dengan volume pasokan batubara DMO stabil.",
        keyCatalyst: "Komitmen dividen BUMN kas melimpah",
        fallbackPrice: 2780,
        fallbackChangePct: 0.7,
      },
    ],
  },
  REGULASI: {
    categoryLabel: "Isu Kebijakan 70% Tambang",
    categoryIcon: "🚨",
    badge: "⚠️ WASPADA REGULASI (Rotasi Taktis)",
    badgeColor: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300",
    defaultScore: 78,
    defaultSummary:
      "Pernyataan arahan optimalisasi 70% hasil pengelolaan minerba memicu kekhawatiran kenaikan royalti pada feronikel/nikel mentah. Disarankan menghindari spekulasi agresif dan mengalihkan fokus ke emiten dengan bantalan emas ritel tebal.",
    picks: [
      {
        kode: "ANTM",
        nama: "Aneka Tambang Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Antre di Support Kuat",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+2.5% s/d +5.0%",
        rationale: "Sekitar 65% omset Antam berasal dari emas fisik Logam Mulia ritel yang kebal royalti mentah. Peluang akumulasi bertahap di area support Rp 1.400 - 1.450.",
        keyCatalyst: "Bantalan kas emas Logam Mulia kebal royalti",
        fallbackPrice: 1450,
        fallbackChangePct: -1.8,
      },
      {
        kode: "NCKL",
        nama: "Trimegah Bangun Persada Tbk",
        action: "BUY_ON_WEAKNESS",
        actionLabel: "Hilirisasi HPAL Baterai",
        actionBadgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300",
        targetReboundPct: "+2.0% s/d +4.5%",
        rationale: "Pabrik HPAL memproduksi bahan baku baterai kendaraan listrik (MHP) dengan nilai tambah tinggi yang didukung penuh pemerintah.",
        keyCatalyst: "Pionir hilirisasi nikel baterai berbiaya rendah",
        fallbackPrice: 880,
        fallbackChangePct: 1.1,
      },
    ],
  },
  ENERGI: {
    categoryLabel: "Reli Minyak & Energi Global",
    categoryIcon: "🛢️",
    badge: "🟢 MOMENTUM ENERGI (Rebound Kuat)",
    badgeColor: "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-300",
    defaultScore: 86,
    defaultSummary:
      "Ketegangan rantai pasok energi global dan pengetatan kuota produksi minyak mentah dunia mengangkat sentimen positif ke emiten hulu migas dan infrastruktur distribusi gas bumi domestik.",
    picks: [
      {
        kode: "MEDC",
        nama: "Medco Energi Internasional Tbk",
        action: "MOMENTUM_BUY",
        actionLabel: "Momentum Minyak Dunia",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+2.5% s/d +5.0%",
        rationale: "Pertumbuhan produksi ladang migas lepas pantai dengan efisiensi biaya angkat (lifting cost) kompetitif.",
        keyCatalyst: "Sensitivitas tinggi terhadap harga minyak WTI & Brent",
        fallbackPrice: 1280,
        fallbackChangePct: 2.1,
      },
      {
        kode: "PGAS",
        nama: "Perusahaan Gas Negara Tbk",
        action: "BEST_BUY",
        actionLabel: "Arus Kas Monopoli Gas",
        actionBadgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300",
        targetReboundPct: "+1.8% s/d +3.5%",
        rationale: "Volume niaga gas bumi industri stabil didukung dividen kas BUMN konsisten dengan yield kas >7%.",
        keyCatalyst: "Monopoli jaringan pipa gas transmisi nasional",
        fallbackPrice: 1530,
        fallbackChangePct: 1.3,
      },
    ],
  },
};

function formatTimeAgo(date: Date): string {
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} hari lalu`;
}

async function fetchRssItems(query: string): Promise<RawNewsFeedItem[]> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Investara/1.0",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const xml = await res.text();

    const itemRegex =
      /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<source[\s\S]*?>([\s\S]*?)<\/source>[\s\S]*?<\/item>/gi;

    const items: RawNewsFeedItem[] = [];
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const rawTitle = match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
      const link = match[2].trim();
      const pubDateStr = match[3].trim();
      const source = match[4].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() || "Portal Finansial";

      const cleanTitle = rawTitle.replace(new RegExp(`\\s*-\\s*${source}$`, "i"), "");
      const pubDate = new Date(pubDateStr);

      items.push({
        title: cleanTitle,
        source,
        link,
        pubDate: isNaN(pubDate.getTime()) ? new Date() : pubDate,
      });
    }

    return items;
  } catch {
    return [];
  }
}

export async function getDynamicNewsCatalysts(force = false): Promise<DynamicCatalystGroup[]> {
  const now = Date.now();
  if (!force && cachedCatalysts && now - cachedCatalysts.timestamp < CACHE_TTL_MS) {
    return cachedCatalysts.data;
  }

  // 1. Fetch live Indonesian financial RSS feeds
  const [generalItems, topicItems] = await Promise.all([
    fetchRssItems("saham OR IHSG OR bursa efek indonesia"),
    fetchRssItems("kebijakan tambang 70% OR royalti emas OR suku bunga bi rate OR dividen interim"),
  ]);

  const allFeedItems = [...generalItems, ...topicItems];

  // 2. Perform automated topic clustering based on keyword matching
  const clusters: Record<"EMAS" | "BUNGA" | "DIVIDEN" | "REGULASI" | "ENERGI", RawNewsFeedItem[]> = {
    EMAS: [],
    BUNGA: [],
    DIVIDEN: [],
    REGULASI: [],
    ENERGI: [],
  };

  for (const item of allFeedItems) {
    const text = item.title.toLowerCase();

    if (text.includes("70%") || text.includes("kebijakan tambang") || text.includes("royalti tambang") || text.includes("esdm")) {
      clusters.REGULASI.push(item);
    } else if (text.includes("emas") || text.includes("gold") || text.includes("logam mulia")) {
      clusters.EMAS.push(item);
    } else if (text.includes("bunga") || text.includes("bi-rate") || text.includes("the fed") || text.includes("fomc") || text.includes("bank") || text.includes("rupiah")) {
      clusters.BUNGA.push(item);
    } else if (text.includes("dividen") || text.includes("interim") || text.includes("laba bersih")) {
      clusters.DIVIDEN.push(item);
    } else if (text.includes("minyak") || text.includes("oil") || text.includes("migas") || text.includes("brent") || text.includes("wti")) {
      clusters.ENERGI.push(item);
    }
  }

  // 3. Assemble dynamic catalyst groups
  const dynamicGroups: DynamicCatalystGroup[] = [];

  const themeKeys: ("EMAS" | "BUNGA" | "DIVIDEN" | "REGULASI" | "ENERGI")[] = [
    "EMAS",
    "BUNGA",
    "DIVIDEN",
    "REGULASI",
    "ENERGI",
  ];

  for (const theme of themeKeys) {
    const config = THEME_PICKS_CATALOG[theme];
    const matchingNews = clusters[theme];

    let headline = "";
    let source = "";
    let timeAgo = "Terbaru Hari Ini";
    let isLiveScanned = false;

    if (matchingNews && matchingNews.length > 0) {
      // Pick the most recent fresh headline from live feed
      const topNews = matchingNews[0];
      headline = topNews.title;
      source = topNews.source;
      timeAgo = formatTimeAgo(topNews.pubDate);
      isLiveScanned = true;
    } else {
      // Fallback headline if no match in today's RSS feed
      if (theme === "EMAS") {
        headline = "Harga Emas Internasional Sentuh Rekor Tertinggi Baru Sepanjang Masa: Margin Penambang Emas Melesat";
        source = "CNBC Indonesia & Kontan";
      } else if (theme === "BUNGA") {
        headline = "Ekspektasi Siklus Pemangkasan Suku Bunga: Biaya Dana (CoF) Perbankan Turun & Kredit Siap Rebound";
        source = "Bisnis.com & Bloomberg";
      } else if (theme === "DIVIDEN") {
        headline = "Musim Pembagian Dividen Interim Q4: Sejumlah Emiten Energi Siapkan Yield Kas Menggiurkan";
        source = "Investor Daily & BEI";
      } else if (theme === "REGULASI") {
        headline = "Arahan Presiden Terkait 70% Hasil Minerba Dinikmati Negara: Strategi Memilih Saham Bertahan & Anti-Panik";
        source = "CNBC Indonesia & Detik Finance";
      } else {
        headline = "Harga Minyak Dunia Menguat Ditopang Ketegangan Rantai Pasok Energi & Kuota OPEC+";
        source = "Reuters & Bisnis.com";
      }
    }

    const { sentiment } = classifyNewsSentiment(headline);

    // Adjust badge and conviction score based on sentiment
    let badge = config.badge;
    let badgeColor = config.badgeColor;
    let convictionScore = config.defaultScore;

    if (sentiment === "REGULASI_NEGATIF") {
      badge = "⚠️ WASPADA REGULASI (Rotasi Taktis)";
      badgeColor = "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300";
      convictionScore = 78;
    } else if (sentiment === "BULLISH") {
      convictionScore = Math.min(95, config.defaultScore + 2);
    }

    dynamicGroups.push({
      id: `catalyst_${theme.toLowerCase()}`,
      category: theme,
      categoryLabel: config.categoryLabel,
      categoryIcon: config.categoryIcon,
      badge,
      badgeColor,
      convictionScore,
      headline,
      source,
      timeAgo,
      catalystSummary: config.defaultSummary,
      recommendedPicks: config.picks,
      isLiveScanned,
    });
  }

  cachedCatalysts = { timestamp: now, data: dynamicGroups };
  return dynamicGroups;
}
