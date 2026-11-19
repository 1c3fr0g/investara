import { NextResponse, type NextRequest } from "next/server";
import { getMacroData } from "@/lib/macro";

export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get("refresh") === "1";
    const data = await getMacroData(force);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengambil data makro" },
      { status: 500 }
    );
  }
}

