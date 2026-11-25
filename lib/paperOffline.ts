export const PAPER_BAR_MS = 5 * 60_000;
export const PAPER_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
export const PAPER_SYNC_LIMIT = 100;

export type OfflineTrade = {
  id: string;
  kode: string;
  entryAt: number;
  targetTp1: number;
  targetTp2: number;
  stopLoss: number;
};

export type OfflineTradeEnd = { id: string; at: number | null };
export type OfflineFill = {
  id: string;
  status: "TP1_HIT" | "TP2_HIT" | "SL_HIT";
  exitAt: number;
  exitPrice: number;
};
export type PaperBar = { at: number; open: number; high: number; low: number };

export function findOfflineFill(trade: OfflineTrade, from: number, through: number, bars: PaperBar[]): OfflineFill | null {
  for (const bar of bars) {
    const exitAt = bar.at + PAPER_BAR_MS;
    if (bar.at < Math.max(from, trade.entryAt) || exitAt > through) continue;

    // The open precedes other prices. Within the candle, use SL when the sequence is ambiguous.
    let status: OfflineFill["status"];
    if (bar.open >= trade.targetTp2) status = "TP2_HIT";
    else if (bar.open >= trade.targetTp1) status = "TP1_HIT";
    else if (bar.low <= trade.stopLoss) status = "SL_HIT";
    else if (bar.high >= trade.targetTp1) status = trade.targetTp1 === trade.targetTp2 ? "TP2_HIT" : "TP1_HIT";
    else continue;

    const exitPrice = status === "TP2_HIT" ? trade.targetTp2 : status === "TP1_HIT" ? trade.targetTp1 : trade.stopLoss;
    return { id: trade.id, status, exitAt, exitPrice };
  }
  return null;
}
