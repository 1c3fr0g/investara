import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addWatch, listWatchlist, removeWatch } from "@/lib/db";

const unauthorized = () => NextResponse.json({ error: "Belum login" }, { status: 401 });
const kodeOf = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9]{4}$/.test(v.trim()) ? v.trim().toUpperCase() : null);

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  return NextResponse.json({ kodes: await listWatchlist(s.user.id) });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const kode = kodeOf((await req.json().catch(() => null))?.kode);
  if (!kode) return NextResponse.json({ error: "Kode tidak valid" }, { status: 400 });
  await addWatch(s.user.id, kode);
  return NextResponse.json({ kodes: await listWatchlist(s.user.id) });
}

export async function DELETE(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const kode = kodeOf(new URL(req.url).searchParams.get("kode"));
  if (!kode) return NextResponse.json({ error: "Kode tidak valid" }, { status: 400 });
  await removeWatch(s.user.id, kode);
  return NextResponse.json({ kodes: await listWatchlist(s.user.id) });
}
