import { listOfflineWatchCodes, listOfflineWatches, saveOfflineWatchResults } from "./db";
import { getPaperIntradayBars } from "./market";
import { findOfflineFill, PAPER_BAR_MS, PAPER_LOOKBACK_MS } from "./paperOffline";

export async function runOfflinePaperSweep(now = Date.now()) {
  const codes = await listOfflineWatchCodes(40, now);
  const lookback = now - PAPER_LOOKBACK_MS;
  const completedThrough = now - PAPER_BAR_MS;
  let failed = 0;

  for (let i = 0; i < codes.length; i += 8) {
    const scan = await Promise.allSettled(codes.slice(i, i + 8).map(async (kode) => {
      const watches = await listOfflineWatches(kode);
      const from = watches.reduce((earliest, watch) => Math.min(earliest, Math.max(lookback, watch.registeredAt, watch.trade.entryAt)), now);
      const bars = from < completedThrough ? await getPaperIntradayBars(kode, from, now) : [];
      const latestBarEnd = (bars.at(-1)?.at ?? 0) + PAPER_BAR_MS;
      return watches.map(({ userId, trade, registeredAt, endAt }) => ({
        userId, id: trade.id,
        fill: findOfflineFill(trade, Math.max(registeredAt, lookback), Math.min(endAt ?? now, completedThrough), bars),
        endAt: endAt !== null && (endAt <= lookback || (endAt <= latestBarEnd && endAt <= completedThrough)) ? endAt : null,
      }));
    }));

    for (const [offset, result] of scan.entries()) {
      if (result.status === "rejected") failed++;
      await saveOfflineWatchResults(codes[i + offset], now, result.status === "fulfilled" ? result.value : []);
    }
  }
  return { checked: codes.length, failed };
}
