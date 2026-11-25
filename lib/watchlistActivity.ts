import issuers from "./emiten.json";
import { readNewsFeed, type SourcedNews } from "./news";

export type WatchlistActivityItem = {
  id: string;
  kind: "price" | "filter" | "news";
  kodes: string[];
  title: string;
  detail: string;
  at: number;
  href: string;
};

export type WatchlistActivityResponse = {
  items: WatchlistActivityItem[];
  newsStatus: "ready" | "partial" | "unavailable";
  alertUnavailable: boolean;
  newsLimited: boolean;
};

export const WATCHLIST_ACTIVITY_DAYS = 3;
const NEWS_STOCK_LIMIT = 30;
const NEWS_BATCH_SIZE = 5;
const issuerNames = new Map(issuers.map(({ kode, nama }) => [kode,
  nama.replace(/(?:\s+\(Persero\)|\s+Tb(?:k\.?)?)+$/i, "").trim().replace(/\s+/g, " "),
]));

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function readWatchlistNews(kodes: string[], since: number, now: number) {
  const tracked = kodes.slice(0, NEWS_STOCK_LIMIT);
  const feeds: Promise<SourcedNews[]>[] = [];
  for (let start = 0; start < tracked.length; start += NEWS_BATCH_SIZE) {
    const terms = tracked.slice(start, start + NEWS_BATCH_SIZE).flatMap((kode) => {
      const name = issuerNames.get(kode);
      return name ? [`"${kode}"`, `"${name}"`] : [`"${kode}"`];
    });
    feeds.push(readNewsFeed(`(${terms.join(" OR ")}) when:${WATCHLIST_ACTIVITY_DAYS}d`));
  }

  const results = await Promise.allSettled(feeds);
  const items = new Map<string, WatchlistActivityItem>();
  const urls = new Set<string>();
  const articles = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  for (const article of articles.sort((a, b) => b.publishedAt - a.publishedAt)) {
    if (article.publishedAt < since || article.publishedAt > now) continue;
    const normalized = normalize(article.judul);
    if (items.has(normalized) || urls.has(article.url)) continue;
    const codes = new Set(article.judul.match(/\b[A-Z0-9]{4}\b/g));
    const matched = tracked.filter((kode) => {
      const name = normalize(issuerNames.get(kode) ?? "");
      return codes.has(kode) || (name.length >= 8 && (` ${normalized} `).includes(` ${name} `));
    });
    if (!matched.length) continue;
    urls.add(article.url);
    items.set(normalized, {
      id: "news:" + article.id, kind: "news", kodes: matched, title: article.judul,
      detail: article.penerbit, at: article.publishedAt, href: article.url,
    });
  }

  const failures = results.filter((result) => result.status === "rejected").length;
  const status = failures === 0 ? "ready" : failures === results.length ? "unavailable" : "partial";
  return { items: [...items.values()], status, limited: kodes.length > NEWS_STOCK_LIMIT } as const;
}
