import { NextRequest, NextResponse } from "next/server";
import { bayar, type Checkout } from "@/lib/pos-actions";
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin !== new URL(req.url).origin)
    return NextResponse.json(
      { error: "Permintaan lintas situs ditolak." },
      { status: 403 },
    );
  const text = await req.text();
  if (text.length > 65536)
    return NextResponse.json(
      { error: "Transaksi terlalu besar." },
      { status: 413 },
    );
  try {
    const c = JSON.parse(text) as Checkout;
    if (
      !c ||
      !Array.isArray(c.items) ||
      !c.items.length ||
      c.items.length > 100
    )
      return NextResponse.json(
        { error: "Keranjang tidak valid." },
        { status: 400 },
      );
    const r = await bayar(c);
    return NextResponse.json(r, { status: r.error ? 400 : 200 });
  } catch {
    return NextResponse.json(
      {
        error:
          "Transaksi belum dapat diproses. Periksa isian atau hubungi SPV.",
      },
      { status: 400 },
    );
  }
}
