import { activityPeriod, parseBrokerActivity, parseInsiderReports } from "./stockActivity";
import { getCuratedReports, parseForeignSnapshot, parsePublicBrokers, type ForeignSnapshot } from "./publicStockActivity";

type Period = ReturnType<typeof activityPeriod>;
const PUBLIC_DATA = "https://ihsg.midoriresearch.com";

export type StockActivityResult = Period & (
  { status: "unconfigured" | "restricted" | "unavailable"; foreign?: ForeignSnapshot | null } |
  { status: "ready"; view: "broker"; source: "invezgo"; data: ReturnType<typeof parseBrokerActivity> } |
  { status: "ready"; view: "broker"; source: "ipot"; data: ReturnType<typeof parsePublicBrokers> } |
  { status: "ready"; view: "insider"; source: "invezgo" | "idx-archive"; data: ReturnType<typeof parseInsiderReports> }
);

export async function getStockActivity(kode: string, view: "broker" | "insider", days: number, page: number): Promise<StockActivityResult> {
  const period = activityPeriod(days);
  const primary = await getInvezgo(kode, view, period, page);
  if (primary.status === "ready") return primary;

  if (view === "insider") {
    const reports = getCuratedReports(kode, period, page);
    return reports.length ? { ...period, status: "ready", view, source: "idx-archive", data: { reports, nextPage: null } } : primary;
  }

  const url = new URL("/api/broker", PUBLIC_DATA);
  url.search = new URLSearchParams({ symbol: kode, ...period, board: "regular", investor: "all" }).toString();
  const [brokerBody, foreignBody] = await Promise.all([
    fetchPublic(url),
    fetchPublic(new URL("/api/market/foreign", PUBLIC_DATA)),
  ]);
  try {
    const data = parsePublicBrokers(brokerBody, kode, period);
    if (data.buyers.length || data.sellers.length) return { ...period, status: "ready", view, source: "ipot", data };
  } catch {
    // The public broker endpoint can return an error or a range that differs from the request.
  }
  return { ...primary, foreign: parseForeignSnapshot(foreignBody, kode, period.to) };
}

async function fetchPublic(url: URL): Promise<unknown> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000), next: { revalidate: 900 } });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function getInvezgo(kode: string, view: "broker" | "insider", period: Period, page: number): Promise<StockActivityResult> {
  const token = process.env.INVEZGO_API_KEY?.trim();
  if (!token) return { ...period, status: "unconfigured" };

  const url = new URL(view === "broker" ? `/analysis/summary/stock/${kode}` : "/analysis/shareholder-insider", "https://api.invezgo.com");
  url.search = new URLSearchParams(view === "broker"
    ? { ...period, investor: "all", market: "RG" }
    : { ...period, code: kode, page: String(page), limit: "10" }).toString();

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(7_000),
      next: { revalidate: view === "broker" ? 900 : 300 },
    });
    if ([401, 402, 403].includes(response.status)) return { ...period, status: "restricted" };
    if (!response.ok) return { ...period, status: "unavailable" };
    const body: unknown = await response.json();
    return view === "broker"
      ? { ...period, status: "ready", view, source: "invezgo", data: parseBrokerActivity(body) }
      : { ...period, status: "ready", view, source: "invezgo", data: parseInsiderReports(body, kode, page) };
  } catch {
    return { ...period, status: "unavailable" };
  }
}
