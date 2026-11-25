// The fixed exchange rate used by Investara's crypto quotes.
export const USD_TO_IDR = 15_850;

export type CryptoPriceCurrency = "IDR" | "USDT";

export function convertCryptoPrice(price: number, from: CryptoPriceCurrency, to: CryptoPriceCurrency) {
  if (from === to) return price;
  return to === "IDR" ? price * USD_TO_IDR : price / USD_TO_IDR;
}
