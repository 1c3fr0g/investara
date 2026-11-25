import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addHoldings, deleteHolding, listHoldings, listTransactions, PortfolioPositionError, updateHolding } from "@/lib/db";

const unauthorized = () => NextResponse.json({ error: "Belum login" }, { status: 401 });

function valid(b: unknown) {
  const o = b as { kode?: unknown; harga_beli?: unknown; lot?: unknown } | null;
  const kode = typeof o?.kode === "string" ? o.kode.trim().toUpperCase() : "";
  const harga_beli = Number(o?.harga_beli);
  const lot = Number(o?.lot);
  if (!/^[A-Z0-9]{4}$/.test(kode) || !(harga_beli > 0) || !(lot > 0) || harga_beli > 1e9 || lot > 1e9) return null;
  return { kode, harga_beli, lot };
}

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  return NextResponse.json({ items: await listHoldings(s.user.id) });
}

// Body: satu holding, atau { items: [...] } untuk impor massal
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const body = await req.json().catch(() => null);
  const list: unknown[] = Array.isArray(body?.items) ? body.items : [body];
  const parsed = list.map(valid);
  if (list.length > 200 || !parsed.every((item) => item !== null)) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const items = await addHoldings(s.user.id, parsed);
  return NextResponse.json({ items }, { status: 201 });
}

export async function PUT(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const harga_beli = Number(body?.harga_beli);
  const lot = Number(body?.lot);
  const expected = body?.expected;
  if (!id || !(harga_beli > 0) || !(lot > 0) || harga_beli > 1e9 || lot > 1e9 ||
      (expected !== undefined && !(typeof expected?.harga_beli === "number" && expected.harga_beli > 0 && Number.isFinite(expected.harga_beli) &&
        typeof expected?.lot === "number" && expected.lot > 0 && Number.isFinite(expected.lot)))) {
    return NextResponse.json({ error: "Data edit tidak valid" }, { status: 400 });
  }
  try {
    if (!await updateHolding(s.user.id, id, { harga_beli, lot, expected })) return NextResponse.json({ error: "Posisi tidak ditemukan" }, { status: 404 });
    const [items, transactions] = await Promise.all([listHoldings(s.user.id), listTransactions(s.user.id)]);
    return NextResponse.json({ ok: true, id, harga_beli, lot, items, transactions });
  } catch (error) {
    if (error instanceof PortfolioPositionError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

export async function DELETE(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (!id || !await deleteHolding(s.user.id, id)) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PortfolioPositionError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
