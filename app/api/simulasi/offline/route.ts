import { auth } from "@/auth";
import { syncOfflineTrades } from "@/lib/db";
import { isKnownCode } from "@/lib/market";
import { PAPER_SYNC_LIMIT, type OfflineTrade, type OfflineTradeEnd } from "@/lib/paperOffline";

const headers = { "Cache-Control": "no-store" };
const validId = (id: unknown) => typeof id === "string" && /^pt_[A-Za-z0-9_]{1,90}$/.test(id);
const validDate = (date: unknown, now: number) => typeof date === "number" && Number.isSafeInteger(date) && date > 0 && date <= now + 5 * 60_000;
const validPrice = (price: unknown) => typeof price === "number" && price > 0 && price <= 1e9;

function validTrade(trade: OfflineTrade | null, now: number) {
  return trade && validId(trade.id) && typeof trade.kode === "string" && isKnownCode(trade.kode)
    && validDate(trade.entryAt, now) && validPrice(trade.stopLoss) && validPrice(trade.targetTp1)
    && validPrice(trade.targetTp2) && trade.stopLoss <= trade.targetTp1 && trade.targetTp1 <= trade.targetTp2;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Belum login." }, { status: 401, headers });
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Response.json({ error: "Gunakan format JSON." }, { status: 415, headers });
  }

  const body: { trades?: OfflineTrade[]; ended?: OfflineTradeEnd[] } | null = await request.json().catch(() => null);
  const now = Date.now();
  const trades = body?.trades;
  const ended = body?.ended;
  if (!Array.isArray(trades) || trades.length > PAPER_SYNC_LIMIT || !trades.every((trade) => validTrade(trade, now))
    || !Array.isArray(ended) || ended.length > PAPER_SYNC_LIMIT || !ended.every((trade) => trade && validId(trade.id) && (trade.at === null || validDate(trade.at, now)))) {
    return Response.json({ error: "Data posisi simulasi tidak valid atau melebihi batas." }, { status: 400, headers });
  }

  const positions = trades.map(({ id, kode, entryAt, targetTp1, targetTp2, stopLoss }) => ({ id, kode, entryAt, targetTp1, targetTp2, stopLoss }));
  return Response.json(await syncOfflineTrades(session.user.id, positions, ended, now), { headers });
}
