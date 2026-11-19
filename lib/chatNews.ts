import { EMITEN } from "./market";
import { fetchNewsFeed, fetchStockNewsFeed, type SourcedNews } from "./news";

const NEWS_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

type Asset = { type: "stock" | "crypto" | null; code?: string };
type NewsTopic = {
  label: string;
  load: () => Promise<SourcedNews[]>;
};

export type ChatNews = {
  articles: { topic: string; article: SourcedNews }[];
  missing: string[];
};

export function asksForNews(query: string): boolean {
  return /\b(?:berita|news|katalis|sentimen|headline|kabar terbaru|isu|royalti)\b|(?:kenapa|mengapa|penyebab|alasan)\b.{0,48}\b(?:turun|naik|anjlok|merah|menguat|melemah|rebound)\b/i.test(query);
}

export function chatNewsTopics(query: string, assets: Asset[], explicitAsset: boolean): NewsTopic[] {
  const macro = [
    [/\b(?:the fed|fomc|federal reserve)\b/i, "The Fed", '"Federal Reserve" OR FOMC', "en"],
    [/\b(?:rupiah|bi rate|bank indonesia|usd\/idr)\b/i, "Rupiah dan Bank Indonesia", 'rupiah OR "Bank Indonesia"', "id"],
    [/\bMSCI\b/i, "MSCI Indonesia", 'MSCI (Indonesia OR IDX)', "en"],
    [/\b(?:tambang|minerba|nikel|royalti)\b/i, "Pertambangan Indonesia", 'Indonesia (tambang OR minerba OR royalti)', "id"],
    [/\b(?:pasar kripto|pasar crypto|pasar altcoin)\b/i, "Pasar kripto", 'cryptocurrency market Bitcoin OR Ethereum', "en"],
    [/\b(?:IHSG|BEI|IDX|pasar saham|bursa indonesia)\b/i, "Pasar saham Indonesia", 'IHSG OR "Bursa Efek Indonesia"', "id"],
  ] as const;
  const match = macro.find(([pattern]) => pattern.test(query));
  if (match && !explicitAsset) {
    const [, label, terms, locale] = match;
    return [{ label, load: () => fetchNewsFeed("(" + terms + ") when:30d", locale) }];
  }

  const topics = new Map<string, NewsTopic>();
  for (const { type, code } of assets) {
    if (!code || topics.has(code)) continue;
    if (type === "stock") {
      const company = EMITEN.find((issuer) => issuer.kode === code);
      if (company) topics.set(code, { label: code, load: () => fetchStockNewsFeed(code, company.nama) });
    } else if (type === "crypto" && /^[A-Z0-9]{2,12}$/.test(code)) {
      topics.set(code, { label: code, load: () => fetchNewsFeed('"' + code + '" (crypto OR cryptocurrency) when:30d', "en") });
    }
  }
  if (topics.size) return [...topics.values()];

  if (asksForNews(query) && /\b(?:kripto|crypto|altcoin)\b/i.test(query)) {
    return [{ label: "Pasar kripto", load: () => fetchNewsFeed('(cryptocurrency market Bitcoin OR Ethereum) when:30d', "en") }];
  }
  return asksForNews(query)
    ? [{ label: "Pasar saham Indonesia", load: () => fetchNewsFeed('(IHSG OR "Bursa Efek Indonesia") when:30d') }]
    : [];
}

export function collectChatNews(groups: { topic: string; articles: SourcedNews[] | null }[], now = Date.now()): ChatNews {
  const seen = new Set<string>();
  const missing: string[] = [];
  const articles = groups.flatMap(({ topic, articles }) => {
    const recent = (articles ?? []).filter((article) =>
      article.publishedAt >= now - NEWS_WINDOW_DAYS * DAY_MS && article.publishedAt <= now,
    );
    if (!recent.length) missing.push(topic);
    const selected = recent.filter((article) => !seen.has(article.url)).slice(0, 3);
    return selected.map((article) => {
      seen.add(article.url);
      return { topic, article };
    });
  });
  return { articles, missing };
}

export function chatNewsContext(news: ChatNews): string {
  return news.articles.map(({ topic, article }, index) => [
    "[" + (index + 1) + "]", topic, article.penerbit, article.tanggal, article.judul,
  ].join(" · ")).join("\n");
}

export function chatNewsReferences(news: ChatNews): string {
  const sources = news.articles.map(({ topic, article }, index) => {
    const publisher = article.penerbit.replace(/[\[\]]/g, "");
    const title = article.judul.replace(/[\[\]`*_<>]/g, "");
    const url = article.url.replace(/\(/g, "%28").replace(/\)/g, "%29");
    return `- [${index + 1}. ${publisher}](${url}) · ${article.tanggal} · **${topic}** · ${title}`;
  });
  return [
    ...(sources.length ? ["#### Sumber berita", ...sources] : []),
    ...(news.missing.length ? ["", "Berita terverifikasi dalam 30 hari terakhir belum tersedia untuk " + news.missing.join(", ") + "."] : []),
  ].join("\n").trim();
}
