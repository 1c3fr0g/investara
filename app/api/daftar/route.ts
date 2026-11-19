import { NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const username = typeof b?.username === "string" ? b.username.trim().toLowerCase() : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!/^[a-z0-9_.-]{3,30}$/.test(username))
    return NextResponse.json({ error: "Username 3-30 karakter (huruf, angka, _ . -)." }, { status: 400 });
  if (password.length < 6 || password.length > 100)
    return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
  if (!await createUser(username, hashPassword(password))) {
    return NextResponse.json({ error: "Username sudah dipakai." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
