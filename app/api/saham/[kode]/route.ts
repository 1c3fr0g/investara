import { NextResponse, type NextRequest } from "next/server";
import { getDetail, isKnownCode } from "@/lib/market";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/saham/[kode]">) {
  const { kode: raw } = await ctx.params;
  const kode = raw.toUpperCase();
  if (!isKnownCode(kode)) return NextResponse.json({ error: "Kode saham tidak dikenal" }, { status: 404 });
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    return NextResponse.json(await getDetail(kode, force));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil data" }, { status: 502 });
  }
}
