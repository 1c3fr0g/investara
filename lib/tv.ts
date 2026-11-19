export type TvInfo = {
  sektor: string | null;
  industri: string | null;
  nilai: number | null;
  roe: number | null;
  margin: number | null;
  der: number | null;
  laba_growth: number | null;
  pendapatan_growth: number | null;
  ex_akan: number | null;
  ex_lalu: number | null;
  bayar_akan: number | null;
  bayar_lalu: number | null;
  cmf: number | null;
  mfi: number | null;
};

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
// TradingView memberi tanggal dalam detik epoch
const tgl = (v: unknown): number | null => (typeof v === "number" && v > 0 ? v * 1000 : null);

const TTL = 30 * 60 * 1000;
let cache: { at: number; map: Map<string, TvInfo> } | null = null;
let pending: Promise<Map<string, TvInfo>> | null = null;

export const IDXIC = [
  "Energi",
  "Barang Baku",
  "Perindustrian",
  "Barang Konsumen Primer",
  "Barang Konsumen Non-Primer",
  "Kesehatan",
  "Keuangan",
  "Properti & Real Estat",
  "Teknologi",
  "Infrastruktur",
  "Transportasi & Logistik",
] as const;

const E = "Energi", B = "Barang Baku", P = "Perindustrian", KP = "Barang Konsumen Primer";
const KN = "Barang Konsumen Non-Primer", H = "Kesehatan", K = "Keuangan", R = "Properti & Real Estat";
const T = "Teknologi", I = "Infrastruktur", TL = "Transportasi & Logistik";

// Pemetaan industri TradingView -> sektor IDX-IC (pendekatan, bukan data resmi BEI)
const INDUSTRI: Record<string, string> = {
  "Coal": E, "Integrated Oil": E, "Oil & Gas Production": E, "Oil Refining/Marketing": E,
  "Contract Drilling": E, "Oilfield Services/Equipment": E,
  "Aluminum": B, "Construction Materials": B, "Forest Products": B, "Other Metals/Minerals": B,
  "Precious Metals": B, "Steel": B, "Chemicals: Agricultural": B, "Chemicals: Major Diversified": B,
  "Chemicals: Specialty": B, "Containers/Packaging": B, "Industrial Specialties": B, "Pulp & Paper": B,
  "Agricultural Commodities/Milling": KP, "Textiles": KN,
  "Commercial Printing/Forms": P, "Miscellaneous Commercial Services": P, "Personnel Services": P,
  "Wholesale Distributors": P, "Environmental Services": P, "Aerospace & Defense": P,
  "Auto Parts: OEM": KN, "Building Products": P, "Electrical Products": P, "Industrial Conglomerates": P,
  "Industrial Machinery": P, "Metal Fabrication": P, "Miscellaneous Manufacturing": P,
  "Office Equipment/Supplies": P, "Trucks/Construction/Farm Machinery": P,
  "Food Distributors": KP, "Food Retail": KP, "Drugstore Chains": KP,
  "Apparel/Footwear": KN, "Beverages: Alcoholic": KP, "Beverages: Non-Alcoholic": KP,
  "Food: Major Diversified": KP, "Food: Meat/Fish/Dairy": KP, "Food: Specialty/Candy": KP,
  "Household/Personal Care": KP, "Tobacco": KP,
  "Advertising/Marketing Services": KN, "Automotive Aftermarket": KN, "Electronics/Appliances": KN,
  "Home Furnishings": KN, "Motor Vehicles": KN, "Other Consumer Specialties": KN,
  "Broadcasting": KN, "Cable/Satellite TV": KN, "Hotels/Resorts/Cruise lines": KN,
  "Movies/Entertainment": KN, "Other Consumer Services": KN, "Publishing: Newspapers": KN,
  "Restaurants": KN, "Electronics Distributors": KN, "Apparel/Footwear Retail": KN,
  "Department Stores": KN, "Electronics/Appliance Stores": KN, "Home Improvement Chains": KN,
  "Specialty Stores": KN,
  "Medical Distributors": H, "Hospital/Nursing Management": H, "Medical/Nursing Services": H,
  "Medical Specialties": H, "Pharmaceuticals: Major": H, "Pharmaceuticals: Other": H,
  "Finance/Rental/Leasing": K, "Financial Conglomerates": K, "Investment Banks/Brokers": K,
  "Investment Managers": K, "Life/Health Insurance": K, "Major Banks": K, "Multi-Line Insurance": K,
  "Property/Casualty Insurance": K, "Regional Banks": K, "Investment Trusts/Mutual Funds": K,
  "Real Estate Development": R, "Real Estate Investment Trusts": R, "Homebuilding": R,
  "Computer Peripherals": T, "Computer Processing Hardware": T, "Electronic Components": T,
  "Electronic Production Equipment": T, "Telecommunications Equipment": T, "Internet Retail": T,
  "Data Processing Services": T, "Information Technology Services": T, "Internet Software/Services": T,
  "Packaged Software": T,
  "Major Telecommunications": I, "Specialty Telecommunications": I, "Wireless Telecommunications": I,
  "Engineering & Construction": I, "Alternative Power Generation": I, "Electric Utilities": I,
  "Gas Distributors": I,
  "Air Freight/Couriers": TL, "Airlines": TL, "Marine Shipping": TL, "Other Transportation": TL,
  "Trucking": TL,
};

// Koreksi per emiten dari daftar contoh IDX-IC
const OVERRIDE: Record<string, string> = {
  ADRO: E, AKRA: E, PGAS: E, ITMG: E, MEDC: E,
  BRPT: B, INKP: B, ESSA: B, BRMS: B,
  ASII: P, UNTR: P,
  INDF: KP, AMRT: KP, CAMP: KP, CMRY: KP, GGRM: KP,
  ACES: KN, AUTO: KN, ERAA: KN, FILM: KN, MAPI: KN,
  INAF: H, KLBF: H, KAEF: H, SIDO: H, SILO: H,
  BBCA: K, BBRI: K, BBNI: K, BMRI: K, BBTN: K,
  BSDE: R, LPKR: R, PWON: R, AMAN: R,
  EMTK: T, GOTO: T, WIRG: T,
  TLKM: I, EXCL: I, ADHI: I, PTPP: I, JSMR: I, TOWR: I, MTEL: I,
  BIRD: TL, TMAS: TL, GIAA: TL,
};

export const sektorIdx = (kode: string, industri: string | null): string | null =>
  OVERRIDE[kode] ?? (industri ? (INDUSTRI[industri] ?? null) : null);

async function load(): Promise<Map<string, TvInfo>> {
  const res = await fetch("https://scanner.tradingview.com/indonesia/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markets: ["indonesia"],
      symbols: { query: { types: [] }, tickers: [] },
      options: { lang: "en" },
      columns: [
        "name",
        "sector",
        "industry",
        "Value.Traded",
        "exchange",
        "return_on_equity",
        "net_margin",
        "debt_to_equity",
        "earnings_per_share_diluted_yoy_growth_ttm",
        "total_revenue_yoy_growth_ttm",
        "dividend_ex_date_upcoming",
        "dividend_ex_date_recent",
        "dividend_payment_date_upcoming",
        "dividend_payment_date_recent",
        "ChaikinMoneyFlow",
        "MoneyFlow",
      ],
      range: [0, 1500],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TradingView ${res.status}`);
  const json = (await res.json()) as { data: { s: string; d: unknown[] }[] };
  const map = new Map<string, TvInfo>();
  for (const row of json.data) {
    const [name, , industriRaw, nilai, exchange, roe, margin, der, labaG, pendG, exAkan, exLalu, bayarAkan, bayarLalu, cmfRaw, mfiRaw] = row.d;
    if (exchange !== "IDX" || typeof name !== "string") continue;
    const industri = typeof industriRaw === "string" ? industriRaw : null;
    map.set(name, {
      sektor: sektorIdx(name, industri),
      industri,
      nilai: n(nilai),
      roe: n(roe),
      margin: n(margin),
      der: n(der) === null ? null : n(der)! * 100,
      laba_growth: n(labaG),
      pendapatan_growth: n(pendG),
      ex_akan: tgl(exAkan),
      ex_lalu: tgl(exLalu),
      bayar_akan: tgl(bayarAkan),
      bayar_lalu: tgl(bayarLalu),
      cmf: n(cmfRaw),
      mfi: n(mfiRaw),
    });
  }
  return map;
}

export async function getTv(force = false): Promise<Map<string, TvInfo>> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.map;
  pending ??= load()
    .then((map) => {
      cache = { at: Date.now(), map };
      return map;
    })
    .catch(() => cache?.map ?? new Map<string, TvInfo>())
    .finally(() => {
      pending = null;
    });
  return pending;
}
