import { NextResponse, type NextRequest } from "next/server";
import { getCryptoDetail, getCryptoMarketItem } from "@/lib/crypto";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await ctx.params;
  if (!symbol) return NextResponse.json({ error: "Symbol crypto tidak valid" }, { status: 400 });

  const cleanSym = symbol.trim();
  const force = req.nextUrl.searchParams.get("refresh") === "1";

  try {
    const detail = req.nextUrl.searchParams.get("quote") === "1"
      ? await getCryptoMarketItem(cleanSym, force)
      : await getCryptoDetail(cleanSym, force);
    if (!detail) {
      return NextResponse.json(
        { error: `Kutipan untuk '${cleanSym.toUpperCase()}' belum tersedia dari penyedia.` },
        { status: 404 }
      );
    }
    return NextResponse.json(detail);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil data cryptocurrency" }, { status: 502 });
  }
}

