import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan, type Perusahaan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { UnduhPdf } from "./pdf";
import { LaporanVisual, type Ringkas, type Visual } from "./visual";

const BOLEH = ["owner", "admin_pusat", "finance", "manajer_area", "mitra"];

export default async function DetailLaporan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data }, { data: pt }] = await Promise.all([
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("perusahaan").select("nama, alamat, email, telepon").limit(1).maybeSingle(),
  ]);
  if (!data) notFound();
  const l = data as unknown as Laporan;
  const h = hitung(l);
  const bulan = namaBulan(l.periode);
  // riwayat laporan outlet ini (untuk tren & pembanding bulan lalu)
  const { data: semua } = await supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("outlet_id", l.outlet_id).eq("mode", "asli").lte("periode", l.periode).is("deleted_at", null).order("periode");
  const riwayat: Ringkas[] = ((semua ?? []) as unknown as Laporan[]).slice(-12).map((r) => {
    const x = hitung(r);
    return { periode: r.periode, label: new Date(r.periode + "T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "2-digit" }), penjualan: x.totalPenjualan, hpp: x.hpp, laba_kotor: x.labaKotor, beban: x.totalBeban, laba_bersih: x.labaBersih };
  });
  const urut = (xs: { name: string; value: number }[]) => xs.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const visual: Visual = {
    bulan,
    penjualan: h.totalPenjualan,
    hpp: h.hpp,
    labaKotor: h.labaKotor,
    beban: h.totalBeban - l.sedekah,
    sedekah: l.sedekah,
    labaBersih: h.labaBersih,
    pendapatan: urut(l.pendapatan.map((p) => ({ name: p.nama.replace(/ \(.*\)$/, ""), value: Number(p.jumlah) }))),
    bebanRinci: urut([{ name: "Sedekah", value: l.sedekah }, ...l.beban.map((b) => ({ name: b.nama.replace(/^Biaya /, ""), value: Number(b.jumlah) }))]).slice(0, 8),
    bagiHasil: l.bagi_hasil.map((b) => ({ name: `${b.nama} ${b.persen}%`, value: Number(b.jumlah) })),
    prev: riwayat.length > 1 ? riwayat[riwayat.length - 2] : null,
    riwayat,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/laporan?outlet=${l.outlet_id}`} className="mr-auto text-sm text-matur-700">
          ← Semua laporan
        </Link>
        <UnduhPdf l={l} visual={visual} pt={(pt ?? { nama: "CV. Hazna Berkah Indonesia", alamat: null, email: null, telepon: null }) as Perusahaan} />
      </div>

      <LaporanVisual v={visual} />

      <article className="space-y-5 rounded-2xl border border-matur-200 bg-white p-4 sm:p-6">
        <header className="flex items-center gap-3 border-b-2 border-kopi-900 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo kop surat */}
          <img src="/brand/hazna-logo.png" alt="Hazna Berkah Indonesia" className="h-14 w-auto shrink-0 sm:h-16" />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-lg font-extrabold uppercase">{pt?.nama ?? "CV. Hazna Berkah Indonesia"}</p>
            {pt?.alamat && <p className="text-xs text-stone-600">{pt.alamat}</p>}
            {(pt?.email || pt?.telepon) && <p className="text-xs text-stone-600">Email: {pt?.email} · Telp: {pt?.telepon}</p>}
          </div>
        </header>
        <h1 className="text-center text-xl font-bold uppercase">Laporan Keuangan {l.nama_outlet}</h1>
        <p className="-mt-3 text-center text-sm text-stone-500">Periode {bulan}</p>

        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
          {[
            ["Nama Outlet", l.nama_outlet],
            ["Tanggal Mulai Operasional", l.outlet?.tgl_mulai ? formatTanggal(l.outlet.tgl_mulai) : "-"],
            ["Jam Operasional", l.outlet?.jam_operasional ?? "-"],
            ["Periode Laporan", bulan],
            ["Mitra", l.mitra ?? "-"],
            ["Penanggung Jawab Laporan", l.pj_laporan ?? "-"],
            ["Jumlah Karyawan", `${l.karyawan.length} orang`],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-stone-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {l.karyawan.length > 0 && (
          <ol className="ml-5 list-decimal text-sm text-stone-700 sm:columns-2">
            {l.karyawan.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ol>
        )}

        <Bagian judul="Modal Outlet">
          <Row k="Saldo awal" v={l.modal_awal} />
        </Bagian>

        <Bagian judul="Harga Pokok Penjualan">
          <Row k="Persediaan awal barang dagangan" v={l.persediaan_awal} />
          <Row k="Pembelian bahan baku" v={l.pembelian} op="+" />
          {Number(l.tagihan_titipan ?? 0) > 0 && <Row k="Tagihan dessert & cheesecake (titipan terjual)" v={Number(l.tagihan_titipan)} op="+" />}
          <Row k="Barang yang tersedia untuk dijual" v={h.tersedia} sub />
          <Row k="Persediaan akhir barang dagangan" v={l.persediaan_akhir} op="−" />
          <Row k="Harga pokok penjualan" v={h.hpp} total />
        </Bagian>

        <Bagian judul="Laba Rugi">
          <p className="pt-1 text-xs font-semibold uppercase text-stone-500">Pendapatan</p>
          {l.pendapatan.map((p) => (
            <Row key={p.nama} k={p.nama} v={p.jumlah} indent />
          ))}
          <Row k="Discount" v={-l.diskon} indent />
          <Row k="Total penjualan" v={h.totalPenjualan} sub />
          <p className="pt-2 text-xs font-semibold uppercase text-stone-500">Pengeluaran</p>
          <Row k="Bahan baku (HPP)" v={h.hpp} indent />
          <Row k="Laba kotor" v={h.labaKotor} sub />
          <p className="pt-2 text-xs font-semibold uppercase text-stone-500">Beban operasional</p>
          <Row k={`Sedekah ${String(l.persen_sedekah).replace(".", ",")}%`} v={l.sedekah} indent />
          {l.beban.map((b) => (
            <Row key={b.nama} k={b.nama} v={b.jumlah} indent />
          ))}
          <Row k="Total beban operasional" v={h.totalBeban} sub />
          <Row k="Laba bersih" v={h.labaBersih} total />
        </Bagian>

        <Bagian judul="Sharing Profit">
          <Row k="Modal awal" v={l.modal_awal} />
          <Row k="Laba outlet" v={h.labaBersih} op="+" />
          <Row k="Modal" v={h.modal} sub />
          {l.bagi_hasil.map((b) => (
            <Row key={b.nama} k={`${/pengelola/i.test(b.nama) ? "Untuk" : "Bagi hasil a.n"} ${b.nama} ${b.persen}%`} v={b.jumlah} indent />
          ))}
          <Row k="Modal akhir" v={l.modal_awal} total />
        </Bagian>

        <Bagian judul="Saldo Sedekah">
          <Row k="Sedekah bulan ini" v={l.sedekah} />
          <Row k="Disalurkan (Kelola Pusat)" v={-l.sedekah} />
          <Row k="Saldo" v={0} total />
        </Bagian>

        <Bagian judul="Penerimaan Transfer Periode Pelaporan">
          <ul className="divide-y text-sm">
            {l.transfer.map((t) => (
              <li key={t.keterangan} className="flex items-start gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.keterangan}</p>
                  <p className="text-xs text-stone-500">{t.no_rekening ? `${t.bank} ${t.no_rekening} a.n ${t.atas_nama}` : "Rekening belum dicantumkan"}</p>
                </div>
                <span className="font-semibold tabular-nums">{formatRupiah(t.jumlah)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(h.totalTransfer)}</span>
            </li>
          </ul>
        </Bagian>

        <footer className="flex justify-end pt-2 text-center text-sm">
          <div>
            <p>
              {l.kota_terbit}, {l.tgl_terbit ? formatTanggal(l.tgl_terbit) : "-"}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- tanda tangan & stempel */}
            <img src="/brand/ttd-hazna.png" alt="Tanda tangan" className="mx-auto my-1 h-20 w-auto" />
            <p className="font-bold underline">{l.penandatangan}</p>
            <p className="text-stone-500">{l.jabatan_penandatangan}</p>
          </div>
        </footer>
        {l.catatan && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Catatan: {l.catatan}</p>}
      </article>
    </div>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 rounded-lg bg-matur-100 px-3 py-1.5 text-sm font-bold uppercase text-kopi-900">{judul}</h2>
      <div className="px-1">{children}</div>
    </section>
  );
}

function Row({ k, v, op, sub, total, indent }: { k: string; v: number; op?: string; sub?: boolean; total?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 py-1 text-sm ${sub ? "border-t font-semibold" : ""} ${total ? "border-t-2 border-kopi-900 font-bold" : ""}`}>
      <span className={`min-w-0 flex-1 ${indent ? "pl-3 text-stone-700" : ""}`}>{k}</span>
      <span className={`whitespace-nowrap tabular-nums ${total ? "text-base" : ""}`}>{formatRupiah(v)}</span>
      <span className="w-4 text-xs text-stone-400">{op ?? ""}</span>
    </div>
  );
}
