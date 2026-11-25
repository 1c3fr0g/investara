import { EMITEN, getStockQuotes } from "./market";
import { readNewsFeed, type SourcedNews } from "./news";
import { getTv, type TvInfo } from "./tv";
import type { NewsSentiment } from "./types";
import { projectSwingPrices } from "./bestBuy";

const HOUR = 60 * 60 * 1000;
const RECENT_NEWS_MS = 72 * HOUR;
const CACHE_TTL_MS = 5 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 20 * 1000;
const AMBIGUOUS_HEADLINE = /\?|\b(bantah|membantah|belum|bukan|tidak|prediksi|proyeksi|diperkirakan|diproyeksikan|jika|potensi)\b/i;

const TOPICS = {
  EMAS: { label: "Emas", icon: "🪙", keywords: /\b(emas|gold|logam mulia)\b/i, query: "(emas OR gold) (saham OR tambang OR harga)" },
  BUNGA: { label: "Suku Bunga", icon: "🏦", keywords: /\b(suku bunga|bi[ -]?rate|the fed|fomc)\b/i, query: '("suku bunga" OR "BI-Rate" OR "The Fed") (BI OR IHSG OR saham)' },
  DIVIDEN: { label: "Dividen", icon: "💰", keywords: /\b(dividen|cum date|ex date)\b/i, query: "dividen (saham OR emiten OR BEI)" },
  REGULASI: { label: "Regulasi", icon: "⚖️", keywords: /\b(royalti|minerba|esdm|larangan ekspor|bea keluar)\b/i, query: "(royalti OR minerba OR ESDM) (saham OR emiten OR tambang)" },
  ENERGI: { label: "Energi", icon: "🛢️", keywords: /\b(minyak|migas|brent|wti|opec|batubara|batu bara)\b/i, query: "(minyak OR migas OR batubara) (saham OR emiten OR harga)" },
  EMITEN: { label: "Emiten", icon: "🏢", keywords: null, query: "(saham OR emiten) (IHSG OR BEI OR IDX)" },
} as const;

const SECTOR_QUERIES = [
  '("sektor pertambangan" OR "emiten tambang" OR "royalti tambang") (Indonesia OR BEI OR saham)',
  '("sektor perbankan" OR "sektor properti" OR "sektor teknologi" OR "sektor kesehatan" OR "sektor transportasi") (IHSG OR BEI)',
];
const ISSUER_SIGNAL_QUERIES = [
  '(saham OR emiten) ("laba naik" OR "laba bersih naik" OR "pendapatan tumbuh" OR "kinerja kuartal")',
  '(saham OR emiten) ("dividen interim" OR "dividen tunai" OR "cum date")',
  '(saham OR emiten) ("kontrak baru" OR "kontrak senilai" OR "menang tender")',
  '(saham OR emiten) ("laba turun" OR "laba bersih turun" OR "rugi bersih" OR "gagal bayar")',
  '(BEI OR emiten) ("suspensi saham" OR "gembok saham" OR "hentikan perdagangan" OR "delisting")',
];

type SectorRule = {
  id: string;
  label: string;
  icon: string;
  explicit: RegExp;
  market?: RegExp;
  industries?: readonly string[];
  sector?: string;
};

const OIL_INDUSTRIES = ["Integrated Oil", "Oil & Gas Production"];
const METAL_INDUSTRIES = ["Precious Metals", "Other Metals/Minerals"];
const MINING_SECTORS: SectorRule[] = [
  { id: "coal", label: "Batu Bara", icon: "⛏️", explicit: /\b(?:sektor|industri|emiten|tambang|pertambangan) (?:batu bara|batubara)\b/i, market: /\b(?:batu bara|batubara)\b/i, industries: ["Coal"] },
  { id: "oil", label: "Minyak & Gas", icon: "🛢️", explicit: /\b(?:sektor|industri|emiten|tambang|pertambangan) (?:migas|minyak(?: dan gas)?|gas alam)\b/i, market: /\b(migas|minyak dunia|minyak mentah|gas alam|brent|wti|opec)\b/i, industries: OIL_INDUSTRIES },
  { id: "gold", label: "Tambang Emas", icon: "🪙", explicit: /\b(?:sektor|industri|emiten|tambang|pertambangan) emas\b/i, market: /\b(?:harga )?emas (?:dunia|global|spot)\b/i, industries: ["Precious Metals"] },
  { id: "metals", label: "Logam & Mineral", icon: "⛏️", explicit: /\b(?:sektor|industri|emiten|tambang|pertambangan|royalti) (?:nikel|tembaga|bauksit|timah|mineral|logam)\b/i, market: /\b(nikel|tembaga|bauksit|timah|bijih besi)\b/i, industries: ["Other Metals/Minerals"] },
];
const MINING: SectorRule = {
  id: "mining", label: "Pertambangan", icon: "⛏️",
  explicit: /\b(?:sektor|industri|emiten|saham|royalti|izin) (?:tambang|pertambangan|minerba)\b/i,
  market: /\b(pertambangan|minerba)\b/i,
  industries: ["Coal", ...OIL_INDUSTRIES, ...METAL_INDUSTRIES],
};
const OTHER_SECTORS: SectorRule[] = [
  { id: "banks", label: "Perbankan", icon: "🏦", explicit: /\b(?:(?:sektor|industri) (?:perbankan|bank)|(?:emiten|saham) perbankan)\b/i, market: /\b(?:emiten|saham) bank\b/i, industries: ["Major Banks", "Regional Banks"] },
  { id: "property", label: "Properti & Real Estat", icon: "🏢", explicit: /\b(?:sektor|industri|emiten|saham) (?:properti|real estat)\b/i, sector: "Properti & Real Estat" },
  { id: "technology", label: "Teknologi", icon: "💻", explicit: /\b(?:sektor|industri|emiten|saham) teknologi\b/i, sector: "Teknologi" },
  { id: "health", label: "Kesehatan", icon: "🏥", explicit: /\b(?:sektor|industri|emiten|saham) kesehatan\b/i, sector: "Kesehatan" },
  { id: "transport", label: "Transportasi & Logistik", icon: "🚚", explicit: /\b(?:sektor|industri|emiten|saham) (?:transportasi|logistik)\b/i, sector: "Transportasi & Logistik" },
  { id: "infrastructure", label: "Infrastruktur", icon: "🏗️", explicit: /\b(?:sektor|industri|emiten|saham) infrastruktur\b/i, sector: "Infrastruktur" },
];

type Topic = keyof typeof TOPICS;
type Article = Pick<SourcedNews, "judul" | "penerbit" | "url" | "publishedAt"> & { sentiment: NewsSentiment };
export type NewsDirection = "TAKE" | "AVOID" | "WATCH";
type IssuerEvidence = { kode: string; nama: string; articles: Article[] };

type PickWithQuote = {
  kode: string;
  nama: string;
  article: Article;
  articleCount: number;
  positiveSources: number;
  negativeSources: number;
  direction: NewsDirection;
  reason: string;
  harga: number | null;
  perubahan_pct: number | null;
  projection?: ReturnType<typeof projectSwingPrices>;
  sectorLabel?: string;
  sectorOnly?: boolean;
};

type CatalystGroup = {
  id: Topic;
  label: string;
  icon: string;
  article: Article;
  picks: PickWithQuote[];
};

type SectorGroup = Omit<CatalystGroup, "id"> & { id: string };

export type NewsScan = {
  updatedAt: string;
  status: "ready" | "partial" | "unavailable";
  picks: PickWithQuote[];
  catalysts: CatalystGroup[];
  sectors: SectorGroup[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const issuerByCode = new Map(EMITEN.map((issuer) => [issuer.kode, issuer]));
const issuerNames = EMITEN.map(({ nama, kode }) => ({
  name: normalize(nama).replace(/(?: (?:persero|tbk|tb))+$/, ""),
  kode,
})).filter(({ name }) => name.length >= 8 && name.includes(" "));

function mentionedIssuers(title: string) {
  const codes = new Set<string>();
  // Explicit ticker markers avoid matching ordinary words that are also IDX codes.
  const ticker = /\b(?:saham|emiten|kode(?: saham)?)\s+([A-Z]{4})\b|\(([A-Z]{4})\)|\b([A-Z]{4})\.JK\b|^([A-Z]{4})(?=\s*[:–—])/gi;
  for (const [, prefixed, parenthesized, symbol, leading] of title.matchAll(ticker)) {
    const code = prefixed ?? parenthesized ?? symbol ?? leading;
    if (issuerByCode.has(code)) codes.add(code);
  }

  // Issuer-first headlines often omit "saham" or parentheses.
  const issuerAction = /^(?:PT\s+)?([A-Z]{3,4})\s+(?:resmi\s+|akan\s+)?(?:umumkan|tebar|bagikan|bayar(?:kan)?|bagi|guyur|catat|bukukan|raih|menangkan|amankan|kantongi|cetak|alami|derita|laba|pendapatan|penjualan|rugi bersih|terancam|digugat|disuspensi|gagal bayar|masuk pkpu)\b/i.exec(title);
  const metricIssuer = /^(?:laba(?: bersih)?|pendapatan|penjualan|rugi bersih|dividen(?: tunai)?)\s+([A-Z]{3,4})\s+(?=naik|turun|tumbuh|meningkat|menurun|susut|menyusut|melonjak|melesat|merosot|membengkak|terpangkas|anjlok)/i.exec(title);
  const leadingCode = issuerAction?.[1] ?? metricIssuer?.[1];
  if (leadingCode && leadingCode === leadingCode.toUpperCase()) {
    const kode = leadingCode === "BCA" ? "BBCA" : leadingCode;
    if (issuerByCode.has(kode)) codes.add(kode);
  }

  const normalizedTitle = " " + normalize(title) + " ";
  for (const { name, kode } of issuerNames) {
    if (normalizedTitle.includes(" " + name + " ")) codes.add(kode);
  }
  return codes;
}

function topicFor(title: string): Topic {
  if (TOPICS.DIVIDEN.keywords.test(title)) return "DIVIDEN";
  for (const topic of ["REGULASI", "BUNGA", "EMAS", "ENERGI"] as const) {
    if (TOPICS[topic].keywords.test(title)) return topic;
  }
  return "EMITEN";
}

function headlineSentiment(title: string, topic: Topic, issuerCode?: string): Article["sentiment"] {
  if (AMBIGUOUS_HEADLINE.test(title)) return "NEUTRAL";
  const metricTitle = issuerCode
    ? title.replace(/\b(laba bersih|laba|pendapatan|penjualan|dividen tunai|dividen|rugi bersih)\s+([A-Z]{3,4})(?=\s)/gi, (text, metric, code) =>
      code === issuerCode || (issuerCode === "BBCA" && code === "BCA") ? metric : text)
    : title;
  const growing = /\b(?:laba(?: bersih)?|pendapatan|penjualan|dividen(?: tunai)?)\s+(?:naik|tumbuh|meningkat|melonjak|melesat)\b/i;
  const dividend = /\b(?:umumkan|tebar|bagikan|bayar(?:kan)?|bagi|guyur|membagikan|membayar)\s+dividen(?: tunai| interim| final)?\s+(?:sebesar\s+)?Rp\s*\d/i;
  const contract = /\b(?:raih|meraih|amankan|mengamankan|kantongi|mengantongi|dapat|mendapatkan|menangkan)\s+kontrak\s+(?:kerja\s+)?baru\b/i;
  const positive = growing.test(metricTitle) || contract.test(title)
    || (dividend.test(title) && !/\b(?:non[ -]?tunai|dividen saham)\b/i.test(title));
  const weakening = /\b(?:laba(?: bersih)?|pendapatan|penjualan|dividen(?: tunai)?)\s+(?:turun|menurun|terpangkas|anjlok|merosot|susut|menyusut)\b/i;
  const issuerRisk = /\b(?:(?:mencatat|catat(?:kan)?|bukukan|membukukan|alami|mengalami) rugi bersih|rugi bersih (?:membengkak|melonjak|naik)|gagal bayar|masuk pkpu|digugat|kena sanksi|dijatuhi sanksi)\b/i;
  const halted = /\b(?:BEI\s+(?:resmi\s+)?(?:suspensi|gembok|setop)\s+saham|hentikan\s+(?:sementara\s+)?perdagangan\s+(?:efek|saham)|(?:saham|emiten)\s+[A-Z]{4}\s+disuspensi)\b/i;
  const negative = weakening.test(metricTitle) || issuerRisk.test(metricTitle)
    || (halted.test(title) && !/\b(?:cabut|dicabut|buka kembali|dibuka kembali)\b/i.test(title));
  if (positive === negative) return !positive && topic === "REGULASI" ? "REGULASI_NEGATIF" : "NEUTRAL";
  return positive ? "BULLISH" : "BEARISH";
}

function sectorMatches(title: string, issuerCount: number) {
  const matches = (rule: SectorRule) => rule.explicit.test(title) || (!issuerCount && rule.market?.test(title));
  const mining = MINING_SECTORS.filter(matches);
  if (!mining.length && matches(MINING)) mining.push(MINING);
  return [...mining, ...OTHER_SECTORS.filter(matches)];
}

function buildGroups(items: SourcedNews[], now: number) {
  const grouped = new Map<Topic, { article: Article; codes: Set<string> }>();
  const issuers = new Map<string, IssuerEvidence>();
  const sectorNews = new Map<string, { rule: SectorRule; article: Article }>();
  const urls = new Set<string>();
  const titles = new Set<string>();
  const recent = items
    .filter((item) => item.publishedAt <= now && item.publishedAt > now - RECENT_NEWS_MS)
    .sort((a, b) => b.publishedAt - a.publishedAt);

  for (const item of recent) {
    const title = normalize(item.judul);
    if (urls.has(item.url) || titles.has(title)) continue;
    urls.add(item.url);
    titles.add(title);

    const id = topicFor(item.judul);
    const codes = mentionedIssuers(item.judul);
    const { judul, penerbit, url, publishedAt } = item;
    const issuerCode = codes.size === 1 ? [...codes][0] : undefined;
    const article = { judul, penerbit, url, publishedAt, sentiment: headlineSentiment(judul, id, issuerCode) };
    const relatedSectors = sectorMatches(judul, codes.size);
    for (const rule of relatedSectors) {
      if (!sectorNews.has(rule.id)) sectorNews.set(rule.id, { rule, article });
    }
    if (id === "EMITEN" && !codes.size) continue;
    let group = grouped.get(id);
    if (!group) {
      group = { article, codes: new Set() };
      grouped.set(id, group);
    }
    // Sector-wide and multi-issuer headlines do not establish individual direction.
    const issuerArticle = codes.size > 1 || relatedSectors.length ? { ...article, sentiment: "NEUTRAL" as const } : article;
    for (const kode of codes) {
      group.codes.add(kode);
      const evidence = issuers.get(kode);
      if (evidence) evidence.articles.push(issuerArticle);
      else issuers.set(kode, { kode, nama: issuerByCode.get(kode)!.nama, articles: [issuerArticle] });
    }
  }

  return { grouped, issuers, sectorNews };
}

type Quote = { harga: number; perubahan_pct: number | null };

function rankIssuer({ kode, nama, articles }: IssuerEvidence, quote: Quote | undefined): PickWithQuote {
  const sources = new Map<string, Article>();
  for (const article of articles) {
    if (article.sentiment !== "BULLISH" && article.sentiment !== "BEARISH") continue;
    const publisher = normalize(article.penerbit);
    if (!sources.has(publisher)) sources.set(publisher, article);
  }
  const votes = [...sources.values()];
  const positiveSources = votes.filter((article) => article.sentiment === "BULLISH").length;
  const negativeSources = votes.length - positiveSources;
  const latest = votes[0];
  const result = {
    kode, nama, article: latest ?? articles[0], articleCount: articles.length, positiveSources, negativeSources,
    harga: quote?.harga ?? null, perubahan_pct: quote?.perubahan_pct ?? null,
  };

  if (negativeSources > positiveSources && latest?.sentiment === "BEARISH") {
    return { ...result, direction: "AVOID", reason: "Berita langsung tentang emiten menunjukkan risiko. Tunda entry sampai risikonya mereda." };
  }
  if (positiveSources > negativeSources && latest?.sentiment === "BULLISH") {
    if (quote && quote.harga > 0 && quote.perubahan_pct !== null && quote.perubahan_pct > 0) {
      return {
        ...result,
        direction: "TAKE",
        projection: projectSwingPrices(quote.harga),
        reason: "Judul condong positif dan perubahan harga harian positif. Periksa titik masuk.",
      };
    }
    return { ...result, direction: "WATCH", reason: "Judul condong positif. Perubahan harga harian belum mengonfirmasi arah." };
  }
  return {
    ...result,
    direction: "WATCH",
    reason: votes.length ? "Arah berita antar sumber masih bercampur." : "Belum ada arah yang jelas dari judul berita emiten.",
  };
}

function limitWatchPicks(picks: PickWithQuote[], watchLimit: number) {
  return (["TAKE", "AVOID", "WATCH"] as const).flatMap((direction) =>
    picks.filter((pick) => pick.direction === direction).slice(0, direction === "WATCH" ? watchLimit : undefined),
  );
}

function membersOf(rule: SectorRule, market: ReadonlyMap<string, TvInfo>) {
  return [...market]
    .filter(([kode, info]) => issuerByCode.has(kode) && (
      rule.industries ? info.industri !== null && rule.industries.includes(info.industri) : info.sektor === rule.sector
    ))
    .sort(([a, first], [b, second]) => (second.nilai ?? 0) - (first.nilai ?? 0) || a.localeCompare(b))
    .slice(0, 6)
    .map(([kode]) => kode);
}

function sectorUnderPressure(article: Article) {
  const pressure = /\b(tertekan|tekanan biaya|tekanan jual|anjlok|merosot|larangan ekspor|pemangkasan kuota)\b|\b(?:royalti|beban|biaya)\b[^.,:;]{0,35}\b(?:naik|meningkat)\b|\b(?:harga|permintaan|produksi)\b[^.,:;]{0,35}\b(?:turun|menurun|terpangkas)\b/i;
  return !AMBIGUOUS_HEADLINE.test(article.judul) && (article.sentiment === "BEARISH" || pressure.test(article.judul));
}

function sectorPick(kode: string, label: string, article: Article, quote: Quote | undefined, underPressure: boolean): PickWithQuote {
  return {
    kode, nama: issuerByCode.get(kode)!.nama, article, articleCount: 1,
    positiveSources: 0, negativeSources: 0, direction: "WATCH", sectorLabel: label, sectorOnly: true,
    reason: underPressure ? `Waspadai potensi tekanan pada industri ${label}.` : `Pantau dampak berita pada industri ${label}.`,
    harga: quote?.harga ?? null, perubahan_pct: quote?.perubahan_pct ?? null,
  };
}

async function scanNews(force: boolean): Promise<NewsScan> {
  const queries = [...Object.values(TOPICS).map(({ query }) => query), ...SECTOR_QUERIES, ...ISSUER_SIGNAL_QUERIES];
  const feeds = await Promise.allSettled(queries.map((query) =>
    readNewsFeed(query + " when:3d", "id", force, ISSUER_SIGNAL_QUERIES.includes(query) ? 24 : 8),
  ));
  const items = feeds.flatMap((feed) => feed.status === "fulfilled" ? feed.value : []);
  const feedFailures = feeds.filter((feed) => feed.status === "rejected").length;
  const { grouped, issuers, sectorNews } = buildGroups(items, Date.now());
  const market = sectorNews.size ? await getTv() : new Map<string, TvInfo>();
  const sectorCandidates = [...sectorNews.values()].map(({ rule, article }) => ({ rule, article, codes: membersOf(rule, market) }));
  const directCodes = [...issuers.keys()];
  const quoteCodes = new Set([...directCodes, ...sectorCandidates.flatMap(({ codes }) => codes)]);
  const quotes = await getStockQuotes([...quoteCodes]).catch(() => new Map<string, never>());
  const ranked = [...issuers.values()]
    .map((issuer) => rankIssuer(issuer, quotes.get(issuer.kode)))
    .sort((a, b) => b.article.publishedAt - a.article.publishedAt || b.articleCount - a.articleCount || a.kode.localeCompare(b.kode));
  const catalysts = Array.from(grouped, ([id, { article, codes }]) => ({
    id, label: TOPICS[id].label, icon: TOPICS[id].icon, article,
    picks: limitWatchPicks(ranked.filter((pick) => codes.has(pick.kode)), 3),
  })).sort((a, b) => Number(b.picks.length > 0) - Number(a.picks.length > 0));

  const direct = new Map(ranked.map((pick) => [pick.kode, pick]));
  const sectors = sectorCandidates.map(({ rule, article, codes }) => {
    const underPressure = sectorUnderPressure(article);
    return {
      id: `sector-${rule.id}`, label: rule.label, icon: rule.icon, article,
      picks: codes.map((kode) => {
        const pick = direct.get(kode);
        return pick && pick.article.url !== article.url
          ? { ...pick, sectorLabel: rule.label }
          : sectorPick(kode, rule.label, article, quotes.get(kode), underPressure);
      }),
    };
  });
  for (const sector of sectors) {
    for (const pick of sector.picks) {
      const current = direct.get(pick.kode);
      if (!current || (!current.sectorOnly && pick.sectorOnly && current.article.url === pick.article.url)) direct.set(pick.kode, pick);
    }
  }

  return {
    updatedAt: new Date(Date.now()).toISOString(),
    status: feedFailures === feeds.length ? "unavailable" : feedFailures ? "partial" : "ready",
    picks: limitWatchPicks([...direct.values()], 6),
    catalysts,
    sectors,
  };
}

let cachedScan: { result: NewsScan; expiresAt: number } | null = null;
let pendingScan: Promise<NewsScan> | null = null;

export function getDynamicNewsCatalysts(force = false): Promise<NewsScan> {
  const now = Date.now();
  if (pendingScan) return pendingScan;
  if (cachedScan && now < cachedScan.expiresAt && (!force || now - Date.parse(cachedScan.result.updatedAt) < REFRESH_COOLDOWN_MS)) {
    return Promise.resolve(cachedScan.result);
  }

  pendingScan = scanNews(force)
    .then((result) => {
      const checkedAt = Date.parse(result.updatedAt);
      const ttl = result.status === "ready" ? CACHE_TTL_MS : 60_000;
      const oldestArticle = Math.min(...result.picks.map((pick) => pick.article.publishedAt), ...[...result.catalysts, ...result.sectors].flatMap((group) => [
        group.article.publishedAt,
        ...group.picks.map((pick) => pick.article.publishedAt),
      ]));
      cachedScan = { result, expiresAt: Math.min(checkedAt + ttl, oldestArticle + RECENT_NEWS_MS) };
      return result;
    })
    .finally(() => { pendingScan = null; });
  return pendingScan;
}
