import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listAlertEvents, markAlertEventsRead } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  return NextResponse.json(await listAlertEvents(session.user.id), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.readAll !== true) return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
  await markAlertEventsRead(session.user.id);
  return NextResponse.json(await listAlertEvents(session.user.id));
}
