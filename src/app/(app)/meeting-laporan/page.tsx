import { semuaHalaman } from "@/lib/paginasi-laporan";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance", "mitra"].includes(s.active.role)
  )
    notFound();
  const sp = await searchParams;
  const db = await supabaseServer();
  const data = await semuaHalaman<{
    id: string;
    laporan_id: string;
    judul: string;
    waktu: string;
    status: string;
    jenis: string;
    lokasi: string;
  }>((a, b) => {
    let q = db
      .from("laporan_meeting")
      .select("id,laporan_id,judul,waktu,status,jenis,lokasi")
      .order("waktu", { ascending: false })
      .order("id");
    if (
      [
        "diajukan",
        "jadwal_pengganti",
        "terjadwal",
        "selesai",
        "batal",
      ].includes(sp.status ?? "")
    )
      q = q.eq("status", sp.status!);
    return q.range(a, b);
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meeting Laporan Keuangan</h1>
      <p className="text-sm text-stone-500">
        Ajukan atau undang meeting dari laporan yang ingin dibahas. Jadwal
        online dan tatap muka mengikuti kesepakatan peserta.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          className="rounded-lg border bg-white px-3 py-2"
          href="/laporan/rekap"
        >
          Buka laporan untuk ajukan meeting →
        </Link>
        <form className="flex gap-2">
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            aria-label="Status meeting"
            className="rounded-lg border p-2"
          >
            <option value="">Semua status</option>
            {[
              "diajukan",
              "jadwal_pengganti",
              "terjadwal",
              "selesai",
              "batal",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="rounded-lg border bg-white px-3">Tampilkan</button>
        </form>
      </div>
      {!data?.length ? (
        <p>Belum ada meeting yang dapat Anda akses.</p>
      ) : (
        data.map((m) => (
          <Link
            key={m.id}
            href={`/laporan/${m.laporan_id}/tindak-lanjut`}
            className="block rounded-2xl border bg-white p-4"
          >
            <h2 className="font-bold">{m.judul}</h2>
            <p>
              {new Date(m.waktu).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB · {m.jenis.replace("_", " ")} · {m.status.replace("_", " ")}
            </p>
            <p className="text-sm text-stone-500">
              {m.lokasi || "Tautan/lokasi belum dilengkapi"}
            </p>
          </Link>
        ))
      )}
    </div>
  );
}
