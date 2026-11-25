const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
});

export const MARKET_DAY_MS = 86_400_000;

/** UTC midnight representing a civil date in Jakarta, for date-only comparisons. */
export function marketDay(timestamp: number) {
  return Date.parse(dayFormat.format(timestamp) + "T00:00:00Z");
}

export function nextMarketAnniversary(timestamp: number) {
  const date = new Date(marketDay(timestamp));
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.getTime();
}
