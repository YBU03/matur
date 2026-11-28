import Link from "next/link";
import { getSession } from "@/lib/session";
import { LaporanKontakMitra } from "@/components/laporan-kontak-mitra";
import type { KontakMitraLaporan } from "@/lib/laporan-kontak-mitra";
import { supabaseServer } from "@/lib/supabase/server";
import { nomorSupport } from "@/lib/support-outlet";
import { namaBulan, type Laporan } from "@/lib/laporan";
export async function LaporanHubLinks({
  laporan: l,
}: {
  laporan: Pick<
    Laporan,
    "id" | "outlet_id" | "nama_outlet" | "periode" | "outlet"
  >;
}) {
  const db = await supabaseServer();
  const session = await getSession();
  const pusat = !!session?.active && ["owner", "admin_pusat", "finance"].includes(session.active.role);
  const [support, mitra] = await Promise.all([
    db
      .from("support_outlet")
      .select("nomor,nama")
      .eq("aktif", true)
      .ilike("bagian", "%akunting%")
      .order("urutan")
      .limit(1)
      .maybeSingle(),
    pusat ? db.rpc("kontak_mitra_laporan", { l: l.id }) : Promise.resolve(null),
  ]);
  const { data, error } = support;
  const nomor = data ? nomorSupport(data.nomor) : null;
  const pesan = `Halo Akunting, saya ingin penjelasan laporan keuangan ${l.outlet?.nama ?? l.nama_outlet}, ${namaBulan(l.periode)}. ${"https://matoer.id/laporan/" + l.id}\nPertanyaan saya: `;
  return (
    <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-matur-200 bg-white p-4">
      <Link
        href={`/laporan/${l.id}/tindak-lanjut`}
        className="rounded-xl bg-kopi-900 px-4 py-2 font-semibold text-white"
      >
        Pembayaran & ajukan pembahasan laporan
      </Link>
      {nomor ? (
        <a
          href={`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-emerald-600 px-4 py-2 font-semibold text-emerald-800"
        >
          Hubungi Akunting via WhatsApp
        </a>
      ) : (
        <Link href="/portal/support-outlet" className="underline">
          {error ? "Kontak belum dapat dimuat" : "Kontak Akunting belum diatur"}{" "}
          · Support Outlet
        </Link>
      )}
      <Link
        href={`/laporan/rekap?outlet=${l.outlet_id}`}
        className="text-sm underline"
      >
        Rekap bulanan & margin %
      </Link>
      {pusat && (
        <LaporanKontakMitra
          kontak={(mitra?.data ?? []) as KontakMitraLaporan[]}
          error={!!mitra?.error}
          bisaKelola={session?.active?.role === "owner" || session?.active?.role === "admin_pusat"}
          laporan={{ id: l.id, nama_outlet: l.outlet?.nama ?? l.nama_outlet, periode: l.periode }}
        />
      )}
      <p className="w-full text-xs text-stone-500">
        WhatsApp membuka pesan awal untuk Anda kirim sendiri. Hak bagi hasil
        berbeda dari pembayaran aktual.
      </p>
    </section>
  );
}
