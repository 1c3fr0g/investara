import { NextResponse, type NextRequest } from "next/server";
import { getUniverse } from "@/lib/market";
import type { ListItem, PasarResponse, SectorStat } from "@/lib/types";

const TOP = 10;
const MIN_NILAI = 1_000_000_000; // abaikan saham tidak likuid agar daftar mover bermakna

export async function GET(request: NextRequest) {
  try {
    const { items, updatedAt } = await getUniverse(request.nextUrl.searchParams.get("refresh") === "1");

    const groups = new Map<string, ListItem[]>();
    for (const i of items) {
      if (!i.sektor) continue;
      groups.set(i.sektor, [...(groups.get(i.sektor) ?? []), i]);
    }
    const sektor: SectorStat[] = [...groups.entries()].map(([nama, list]) => {
      const w = list.filter((i) => i.perubahan_pct !== null && i.mcap);
      const cap = w.reduce((a, i) => a + (i.mcap ?? 0), 0);
      return {
        nama,
        jumlah: list.length,
        perubahan_pct: cap > 0 ? w.reduce((a, i) => a + (i.perubahan_pct ?? 0) * (i.mcap ?? 0), 0) / cap : null,
        naik: list.filter((i) => (i.perubahan_pct ?? 0) > 0).length,
        turun: list.filter((i) => (i.perubahan_pct ?? 0) < 0).length,
        nilai: list.reduce((a, i) => a + (i.nilai ?? 0), 0),
      };
    });
    sektor.sort((a, b) => (b.perubahan_pct ?? -Infinity) - (a.perubahan_pct ?? -Infinity));

    const liquid = items.filter((i) => i.perubahan_pct !== null && (i.nilai ?? 0) >= MIN_NILAI);
    const withForeign = liquid.filter((i) => i.foreign_flow !== null && i.foreign_flow !== undefined);

    const foreignTopBuy = [...withForeign]
      .filter((i) => (i.foreign_flow ?? 0) > 0)
      .sort((a, b) => (b.foreign_flow ?? 0) - (a.foreign_flow ?? 0))
      .slice(0, TOP);

    const foreignTopSell = [...withForeign]
      .filter((i) => (i.foreign_flow ?? 0) < 0)
      .sort((a, b) => (a.foreign_flow ?? 0) - (b.foreign_flow ?? 0))
      .slice(0, TOP);

    const netTotal = withForeign.reduce((acc, i) => acc + (i.foreign_flow ?? 0), 0);
    const buyCount = withForeign.filter((i) => (i.foreign_flow ?? 0) > 0).length;
    const sellCount = withForeign.filter((i) => (i.foreign_flow ?? 0) < 0).length;

    let sentiment: "Akumulasi Masif" | "Akumulasi" | "Netral" | "Distribusi" | "Distribusi Masif" = "Netral";
    if (netTotal > 250_000_000_000) sentiment = "Akumulasi Masif";
    else if (netTotal > 50_000_000_000) sentiment = "Akumulasi";
    else if (netTotal < -250_000_000_000) sentiment = "Distribusi Masif";
    else if (netTotal < -50_000_000_000) sentiment = "Distribusi";

    const body: PasarResponse = {
      updatedAt,
      sektor,
      naik: [...liquid].sort((a, b) => (b.perubahan_pct ?? 0) - (a.perubahan_pct ?? 0)).slice(0, TOP),
      turun: [...liquid].sort((a, b) => (a.perubahan_pct ?? 0) - (b.perubahan_pct ?? 0)).slice(0, TOP),
      nilai: [...items].sort((a, b) => (b.nilai ?? 0) - (a.nilai ?? 0)).slice(0, TOP),
      foreignTopBuy,
      foreignTopSell,
      foreignSummary: {
        netTotal,
        buyCount,
        sellCount,
        sentiment,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil data" }, { status: 502 });
  }
}
