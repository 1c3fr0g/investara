import type { NewsItem, NewsSentiment } from "./types";

const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function classifyNewsSentiment(title: string, summary?: string): {
  sentiment: NewsSentiment;
  sentimentLabel: string;
  ringkasanDampak: string;
  kategori: NewsItem["kategori"];
} {
  const combined = `${title} ${summary || ""}`.toLowerCase();

  // 1. Policy & Regulatory Risk (e.g. 70% tambang, royalti, esdm, pajak)
  const isPolicyRisk =
    combined.includes("70%") ||
    combined.includes("kebijakan") ||
    combined.includes("presiden") ||
    combined.includes("esdm") ||
    combined.includes("pemerintah") ||
    combined.includes("royalti") ||
    combined.includes("pajak") ||
    combined.includes("bea keluar") ||
    combined.includes("pungutan") ||
    combined.includes("larangan ekspor") ||
    combined.includes("regulasi") ||
    combined.includes("aturan") ||
    combined.includes("minerba") ||
    combined.includes("denda") ||
    combined.includes("gugatan") ||
    combined.includes("pkpu") ||
    combined.includes("sanksi");

  if (isPolicyRisk) {
    return {
      sentiment: "REGULASI_NEGATIF",
      sentimentLabel: "🔴 Risiko Regulasi / Kebijakan",
      ringkasanDampak:
        "Sentimen kebijakan pemerintah/regulasi berpotensi memicu volatilitas harga, penyesuaian beban royalti/pajak, dan aksi wait-and-see oleh pemodal institusi.",
      kategori: "REGULASI",
    };
  }

  // 2. Bullish / Positive Catalysts
  const isBullish =
    combined.includes("rekor") ||
    combined.includes("laba melonjak") ||
    combined.includes("laba bersih naik") ||
    combined.includes("dividen jumbo") ||
    combined.includes("dividen interim") ||
    combined.includes("rebound") ||
    combined.includes("akuisisi") ||
    combined.includes("ekspansi") ||
    combined.includes("target harga naik") ||
    combined.includes("kinerja moncer") ||
    combined.includes("pendapatan tumbuh") ||
    combined.includes("surplus") ||
    combined.includes("bullish") ||
    combined.includes("buy rating") ||
    combined.includes("kontrak baru");

  if (isBullish) {
    return {
      sentiment: "BULLISH",
      sentimentLabel: "🟢 Katalis Positif",
      ringkasanDampak:
        "Katalis positif fundamental atau ekspansi bisnis berpotensi mengerek estimasi laba dan mendorong minat beli pelaku pasar.",
      kategori: combined.includes("dividen") ? "DIVIDEN" : combined.includes("laba") ? "KINERJA" : "UMUM",
    };
  }

  // 3. Bearish / Selloff Pressure
  const isBearish =
    combined.includes("anjlok") ||
    combined.includes("turun") ||
    combined.includes("melemah") ||
    combined.includes("koreksi") ||
    combined.includes("rugi") ||
    combined.includes("merosot") ||
    combined.includes("arb") ||
    combined.includes("distribusi") ||
    combined.includes("net sell") ||
    combined.includes("ditinggal asing") ||
    combined.includes("tertekan") ||
    combined.includes("terpangkas");

  if (isBearish) {
    return {
      sentiment: "BEARISH",
      sentimentLabel: "🔴 Tekanan Sentimen / Penjualan",
      ringkasanDampak:
        "Aksi ambil untung atau tekanan jual jangka pendek menguji area support teknikal emiten.",
      kategori: "UMUM",
    };
  }

  // 4. Neutral
  return {
    sentiment: "NEUTRAL",
    sentimentLabel: "🟡 Netral / Informatif",
    ringkasanDampak:
      "Perkembangan korporasi berkala terkait keterbukaan informasi dan operasional rutin.",
    kategori: "UMUM",
  };
}

export type SourcedNews = NewsItem & { publishedAt: number };

const feedCache = new Map<string, { timestamp: number; items: SourcedNews[] }>();
const pendingFeeds = new Map<string, Promise<SourcedNews[]>>();

function rssText(value: string): string {
  return value.trim().replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, (entity) => {
    const named: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    const token = entity.toLowerCase();
    if (token in named) return named[token];
    const code = token.startsWith("&#x") ? parseInt(token.slice(3, -1), 16) : Number(token.slice(2, -1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  }).replace(/\s+/g, " ").trim();
}

export function newsArticleUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname === "/") return null;
    return url.href;
  } catch {
    return null;
  }
}

async function loadNewsFeed(query: string, edition: "id" | "en", limit: number): Promise<SourcedNews[]> {
  const locale = edition === "id" ? "ID" : "US";
  const rss = new URL("https://news.google.com/rss/search");
  rss.search = new URLSearchParams({ q: query, hl: edition, gl: locale, ceid: locale + ":" + edition }).toString();
  const response = await fetch(rss, { cache: "no-store", signal: AbortSignal.timeout(3_500) });
  if (!response.ok) throw new Error(`RSS merespons HTTP ${response.status}.`);

  const xml = await response.text();
  if (!/<rss\b/i.test(xml)) throw new Error("Respons sumber berita bukan RSS.");
  const entries: SourcedNews[] = [];
  for (const [, entry] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const publisher = rssText(entry.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "");
    const rawTitle = rssText(entry.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const suffix = " - " + publisher;
    const title = rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
    const rawLink = rssText(entry.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const link = newsArticleUrl(rawLink);
    const publishedAt = Date.parse(entry.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "");
    if (!publisher || !title || !link || !Number.isFinite(publishedAt)) continue;
    entries.push({
      id: link,
      judul: title,
      penerbit: publisher,
      tanggal: new Date(publishedAt).toLocaleDateString("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }),
      url: link,
      publishedAt,
      ...classifyNewsSentiment(title),
    });
  }
  const unique = new Map<string, SourcedNews>();
  for (const item of entries.sort((a, b) => b.publishedAt - a.publishedAt)) {
    const key = item.judul.toLowerCase();
    if (!unique.has(key)) unique.set(key, item);
    if (unique.size === limit) break;
  }
  return [...unique.values()];
}

export async function readNewsFeed(query: string, edition: "id" | "en" = "id", force = false, limit = 8): Promise<SourcedNews[]> {
  const key = `${edition}:${limit}:${query}`;
  const cached = feedCache.get(key);
  if (!force && cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) return cached.items;
  const pending = pendingFeeds.get(key);
  if (pending) return pending;

  const request = loadNewsFeed(query, edition, limit)
    .then((items) => {
      if (items.length) {
        feedCache.delete(key);
        feedCache.set(key, { timestamp: Date.now(), items });
        if (feedCache.size > 256) {
          const oldestKey = feedCache.keys().next().value;
          if (oldestKey) feedCache.delete(oldestKey);
        }
      }
      return items;
    })
    .finally(() => pendingFeeds.delete(key));
  pendingFeeds.set(key, request);
  return request;
}

export function fetchNewsFeed(query: string, edition: "id" | "en" = "id"): Promise<SourcedNews[]> {
  return readNewsFeed(query, edition).catch(() => []);
}

export function fetchStockNewsFeed(kode: string, nama: string) {
  return fetchNewsFeed("saham " + kode.toUpperCase() + ' OR "' + nama + '"');
}

export async function fetchStockNews(kode: string, nama: string): Promise<NewsItem[]> {
  return fetchStockNewsFeed(kode, nama);
}
