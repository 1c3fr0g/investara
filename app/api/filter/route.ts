import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addFilter, deleteFilter, listFilters, setFilterMonitor } from "@/lib/db";
import { savedScreenerQuery } from "@/lib/screener";

const unauthorized = () => NextResponse.json({ error: "Belum login" }, { status: 401 });

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  return NextResponse.json({ items: await listFilters(s.user.id) });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const b = await req.json().catch(() => null);
  const nama = typeof b?.nama === "string" ? b.nama.trim().slice(0, 60) : "";
  if (!nama || typeof b?.query !== "string" || b.query.length > 2000) {
    return NextResponse.json({ error: "Nama dan filter wajib diisi" }, { status: 400 });
  }
  let query: string;
  try {
    query = savedScreenerQuery(b.query).toString();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Filter tidak valid" }, { status: 400 });
  }
  const item = await addFilter(s.user.id, nama, query);
  if (!item) return NextResponse.json({ error: "Maksimal 50 filter tersimpan" }, { status: 409 });
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string" || typeof body?.monitor !== "boolean") {
    return NextResponse.json({ error: "Pengaturan pantauan tidak valid" }, { status: 400 });
  }
  if (body.monitor) {
    const existing = (await listFilters(userId)).find((filter) => filter.id === body.id);
    if (!existing) return NextResponse.json({ error: "Filter tidak ditemukan" }, { status: 404 });
    try {
      savedScreenerQuery(existing.query);
    } catch {
      return NextResponse.json({ error: "Simpan ulang kriteria filter sebelum mengaktifkan alert." }, { status: 400 });
    }
  }
  const item = await setFilterMonitor(userId, body.id, body.monitor);
  if (!item) return NextResponse.json({ error: "Filter tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!await deleteFilter(s.user.id, id)) return NextResponse.json({ error: "Filter tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
