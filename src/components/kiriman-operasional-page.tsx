import Link from "next/link";
import { konteksOperasional, buktiUrls } from "@/lib/operasional-data";
import {
  KirimanOperasionalView,
  type Shipment,
  type ReceiptRow,
} from "./kiriman-operasional-view";
export async function KirimanOperasionalPage({
  searchParams,
  terminal = false,
}: {
  searchParams: Promise<{ outlet?: string; id?: string }>;
  terminal?: boolean;
}) {
  const sp = await searchParams;
  const { s, db, outlets, outlet } = await konteksOperasional(
    "kiriman",
    sp.outlet,
  );
  const base = terminal ? "/karyawan/kiriman" : "/operasional/kiriman";
  const { data: list, error } = await db
    .from("kiriman")
    .select("id,nomor,status,pemeriksaan_status,tanggal,total,total_kirim")
    .eq("mode", "asli")
    .eq("outlet_id", outlet.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const selected = (list ?? []).find((x) => x.id === sp.id) ?? list?.[0];
  const [
    { data: k, error: ek },
    { data: items, error: ei },
    { data: receipts, error: er },
    { data: pt },
  ] = selected
    ? await Promise.all([
        db
          .from("kiriman")
          .select("*,outlet(nama,alamat),pembuat:pengguna!kiriman_dibuat_oleh_fkey(nama)")
          .eq("id", selected.id)
          .single(),
        db
          .from("item_kiriman")
          .select("*")
          .eq("kiriman_id", selected.id)
          .order("nama"),
        db
          .from("penerimaan_kiriman")
          .select("*")
          .eq("kiriman_id", selected.id)
          .order("waktu", { ascending: false }),
        db
          .from("perusahaan")
          .select("nama,alamat,email,telepon")
          .limit(1)
          .maybeSingle(),
      ])
    : [
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null },
      ];
  if(k)k.pembuat_nama??=(k.pembuat as unknown as {nama:string}|null)?.nama??null;
  if (ek || ei || er) throw new Error("Rincian kiriman tidak dapat dimuat.");
  const urls = await buktiUrls(
    db,
    (receipts ?? []).map((r) => r.foto_path),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pengiriman & Penerimaan Barang</h1>
          <p className="text-sm text-stone-500">
            Surat jalan, invoice, pemeriksaan outlet, dan penyelesaian selisih
            tercatat dalam sistem.
          </p>
        </div>
        {["owner", "admin_pusat", "admin_gudang"].includes(s.active!.role) && (
          <Link
            href="/gudang/kiriman"
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
          >
            Buat / Kirim Barang
          </Link>
        )}
      </div>
      <form className="flex flex-wrap gap-2">
        <select
          name="outlet"
          defaultValue={outlet.id}
          className="rounded-xl border bg-white p-2"
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
        <button className="rounded-xl border bg-white px-3">
          Pilih outlet
        </button>
      </form>
      <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
        <nav className="max-h-96 space-y-2 overflow-auto">
          {(list ?? []).map((x) => (
            <Link
              key={x.id}
              href={`${base}?outlet=${outlet.id}&id=${x.id}`}
              className={`block rounded-xl border p-3 text-sm ${selected?.id === x.id ? "border-matur-500 bg-matur-50" : "bg-white"}`}
            >
              <b>{x.nomor}</b>
              <p>
                {x.tanggal} · {x.status}
              </p>
              <p className="text-xs text-amber-800">
                {x.pemeriksaan_status === "selisih"
                  ? "Ada selisih · perlu tindakan"
                  : ""}
              </p>
            </Link>
          ))}
          {!list?.length && (
            <p className="p-4 text-sm text-stone-500">
              Belum ada kiriman untuk outlet ini.
            </p>
          )}
        </nav>
        {k && (
          <KirimanOperasionalView
            key={`${k.id}:${receipts?.length ?? 0}:${k.status}`}
            shipment={k as unknown as Shipment}
            items={(items ?? []).map((i) => ({
              ...i,
              qty: Number(i.qty),
              qty_diterima: Number(i.qty_diterima ?? 0),
              harga: Number(i.harga),
              konversi: Number(i.konversi),
            }))}
            receipts={(receipts ?? []) as ReceiptRow[]}
            urls={urls}
            gudang={["owner", "admin_pusat", "admin_gudang"].includes(
              s.active!.role,
            )}
            bolehTerima={s.active!.role !== "finance"}
            namaSaya={s.nama}
            pt={
              pt ?? { nama: "Matoer", alamat: null, email: null, telepon: null }
            }
          />
        )}
      </div>
    </div>
  );
}
