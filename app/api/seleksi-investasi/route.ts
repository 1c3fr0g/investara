import { NextResponse, type NextRequest } from "next/server";
import { getUniverse } from "@/lib/market";
import { INVESTMENT_PROFILES, INVESTMENT_LIQUIDITY, INVESTMENT_PAGE_SIZE, rankInvestments, type InvestmentResponse } from "@/lib/investmentRanking";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const profile = INVESTMENT_PROFILES.find(({ id }) => id === params.get("profil"))?.id ?? "seimbang";
  const liquidity = INVESTMENT_LIQUIDITY.find((value) => String(value) === params.get("likuiditas")) ?? 0;
  const sector = params.get("sektor")?.slice(0, 100) ?? "";
  const requestedPage = Math.floor(Number(params.get("halaman")) || 1);

  try {
    const { items, updatedAt } = await getUniverse();
    if (!items.length) throw new Error("Data pasar kosong");
    const { ranked, considered, sectors } = rankInvestments(items, profile, sector, liquidity);
    const pages = Math.max(1, Math.ceil(ranked.length / INVESTMENT_PAGE_SIZE));
    const page = Math.max(1, Math.min(pages, requestedPage));
    const response: InvestmentResponse = {
      items: ranked.slice((page - 1) * INVESTMENT_PAGE_SIZE, page * INVESTMENT_PAGE_SIZE),
      total: ranked.length, considered, sectors, page, pages, updatedAt,
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Data untuk seleksi investasi belum tersedia." }, { status: 502 });
  }
}
