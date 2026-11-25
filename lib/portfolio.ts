export type PortfolioMarket = "stock" | "crypto";

export const CRYPTO_UNITS_PER_COIN = 100_000_000;

export function cryptoQuantityUnits(quantity: number) {
  const units = Math.round(quantity * CRYPTO_UNITS_PER_COIN);
  return Number.isSafeInteger(units) && units > 0 && Number(quantity.toFixed(8)) === quantity ? units : null;
}

export function validPortfolioSymbol(symbol: string, market: PortfolioMarket) {
  return market === "crypto" ? /^[A-Z0-9]{1,20}$/.test(symbol) : /^[A-Z0-9]{4}$/.test(symbol);
}

export function averageOpenBuyPrices(positions: { kode: string; lot: number; harga_beli: number }[]) {
  const totals = new Map<string, { units: number; invested: number }>();
  for (const position of positions) {
    const units = cryptoQuantityUnits(position.lot);
    if (units === null) continue;
    const total = totals.get(position.kode) ?? { units: 0, invested: 0 };
    total.units += units;
    total.invested += units * position.harga_beli;
    totals.set(position.kode, total);
  }
  return Array.from(totals, ([symbol, { units, invested }]) => ({
    symbol, quantity: units / CRYPTO_UNITS_PER_COIN, priceIdr: invested / units,
  })).sort((a, b) => a.symbol.localeCompare(b.symbol));
}
