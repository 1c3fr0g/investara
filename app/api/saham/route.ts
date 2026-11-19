import { NextResponse, type NextRequest } from "next/server";
import { screenStocks, SORTS, type SortKey } from "@/lib/screener";
import { getUniverse } from "@/lib/market";
import type { ListResponse } from "@/lib/types";

const PAGE_SIZE = 10;
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const sortParam = p.get("sort") as SortKey;
  const sort: SortKey = SORTS.includes(sortParam) ? sortParam : "mcap";
  const dir = p.get("dir") === "asc" ? 1 : -1;
  const pageParam = Math.floor(Number(p.get("page")) || 1);
  const size = Math.min(1000, Math.max(1, Math.floor(Number(p.get("size"))) || PAGE_SIZE));

  try {
    const { items, updatedAt } = await getUniverse(p.get("refresh") === "1");
    let list = screenStocks(items, p);

    if (sortParam) {
      list = [...list].sort((a, b) => {
        const x = a[sort], y = b[sort];
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x > y ? 1 : x < y ? -1 : 0) * dir;
      });
    } else if (p.get("grup") === "swing") {
      // Prioritize Super Picks first, then sort by highest probability & foreign flow
      list = [...list].sort((a, b) => {
        const tierRankA = a.swing_tier === "SUPER" ? 2 : 1;
        const tierRankB = b.swing_tier === "SUPER" ? 2 : 1;
        if (tierRankA !== tierRankB) return tierRankB - tierRankA;
        const probDiff = (b.swing_prob ?? 0) - (a.swing_prob ?? 0);
        if (probDiff !== 0) return probDiff;
        return (b.foreign_flow ?? 0) - (a.foreign_flow ?? 0);
      });
    } else {
      list = [...list].sort((a, b) => {
        const x = a[sort], y = b[sort];
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x > y ? 1 : x < y ? -1 : 0) * dir;
      });
    }

    const pages = Math.max(1, Math.ceil(list.length / size));
    const page = Math.min(Math.max(1, pageParam), pages);
    const body: ListResponse = {
      items: list.slice((page - 1) * size, page * size),
      total: list.length,
      page,
      pages,
      updatedAt,
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil data" }, { status: 502 });
  }
}
