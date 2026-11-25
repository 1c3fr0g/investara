import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listWatchlist, listWatchlistAlertEvents } from "@/lib/db";
import { rp } from "@/lib/format";
import { readWatchlistNews, WATCHLIST_ACTIVITY_DAYS, type WatchlistActivityResponse, type WatchlistActivityItem } from "@/lib/watchlistActivity";

export async function GET() {
  const userId = (await auth())?.user?.id;
  const headers = { "Cache-Control": "private, no-store" };
  if (!userId) return NextResponse.json({ error: "Belum login" }, { status: 401, headers });

  const now = Date.now();
  const since = now - WATCHLIST_ACTIVITY_DAYS * 86_400_000;
  const kodes = await listWatchlist(userId);
  const [alerts, news] = await Promise.all([
    listWatchlistAlertEvents(userId, since).catch(() => null),
    readWatchlistNews(kodes, since, now),
  ]);
  if (!alerts && news.status === "unavailable") {
    return NextResponse.json({ error: "Gagal memuat perubahan terbaru." }, { status: 502, headers });
  }

  const events: WatchlistActivityItem[] = (alerts ?? []).map((event) => ({
    id: "alert:" + event.id,
    kind: event.kind,
    kodes: [event.kode],
    title: event.kind === "filter" ? event.label : "Mencapai " + event.label.replace(/^Target /, "target "),
    detail: rp(event.harga),
    at: event.created_at,
    href: event.kind === "filter" && event.query ? "/?" + event.query : "/saham/" + event.kode,
  }));
  const response: WatchlistActivityResponse = {
    items: [...events, ...news.items].sort((a, b) => b.at - a.at).slice(0, 12),
    newsStatus: news.status,
    alertUnavailable: alerts === null,
    newsLimited: news.limited,
  };
  return NextResponse.json(response, { headers });
}
