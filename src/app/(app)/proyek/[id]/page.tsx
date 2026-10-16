import { SelesaiProyek } from "./selesai";
import { totalEstimasiRab } from "@/lib/rab-total";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Progress, sisaHari } from "@/components/proyek-card";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { detailProyek, progresTotal } from "@/lib/proyek";
import { groupRab, totalPembeli } from "@/lib/rab-excel";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { RowDeleter, RowEditor } from "@/components/row-editor";
import { Pegangan, Urutkan } from "@/components/urutkan";
import { Approvals, DesainGallery, RabDownload, ReportButton } from "./client";
import { CentangChecklist, Diskusi, DokumenPanel, LaporanPdf, PakaiTanggal } from "./extra";

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "jadwal", label: "Jadwal" },
  { key: "biaya", label: "Biaya & Dana" },
  { key: "desain", label: "Desain & Foto" },
  { key: "dokumen", label: "Dokumen" },
  { key: "diskusi", label: "Diskusi" },
] as const;

const PROYEK_FIELDS = ["nama", "estimasi_budget", "tgl_mulai", "tgl_soft_opening", "target_buka", "status", "mode_pembelian", "alamat", "maps_url", "luas", "sewa_tempat", "kontak_tempat", "catatan"];
const TAHAP_FIELDS = ["nama", "pic_id", "bobot", "progres", "tgl_mulai", "tgl_selesai", "urutan"];
const JADWAL_FIELDS = ["judul", "tgl_rencana", "tgl_realisasi", "status", "keterangan", "urutan"];
const card = "rounded-2xl border border-matur-200 bg-white p-4";
const addBtn = "rounded-lg border border-matur-300 px-3 py-1.5 text-sm text-matur-700 hover:bg-matur-50";

const hariLagi = (iso: string | null) => {
  const h = sisaHari(iso);
  return h === null ? "" : h > 0 ? `${h} hari lagi` : h === 0 ? "hari ini" : `${-h} hari lalu`;
};

// MTR-01 / PRY: halaman proyek bertab agar mudah dibaca di HP
export default async function DetailProyek({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const tabQ = (await searchParams).tab;
  const tab = TABS.some((t) => t.key === tabQ) ? tabQ! : "ringkasan";
  const s = await getSession();
  if (!s?.active) notFound();
  const d = await detailProyek(id); // RLS: hanya proyek yang boleh dilihat
  if (!d) notFound();
  const { proyek: p, pekerjaan, rab, foto, desain, usulan, jadwal, setoran, checklist, dokumen, komentar, catatan } = d;
  const admin = s.active.role === "owner" || s.active.role === "admin_pusat";
  const bisaUsul = admin || s.active.role === "mitra";
  const progres = p.status === "selesai" ? 100 : progresTotal(pekerjaan);
  const realisasi = rab.reduce((t, r) => t + (r.harga_realisasi ?? 0), 0);
  const estimasiRab = totalEstimasiRab(rab);
  const danaMasuk = setoran.reduce((t, x) => t + x.jumlah, 0);
  const disetujui = foto.filter((f) => f.status === "disetujui");
  const menunggu = foto.filter((f) => f.status === "menunggu");
  const namaPekerjaan = Object.fromEntries(pekerjaan.map((k) => [k.id, k.nama]));
  const ckSelesai = checklist.filter((c) => c.selesai).length;
  const grup = groupRab(rab);
  // daftar PIC untuk form tahapan (admin saja)
  let picRefs: { id: string; label: string }[] = [];
  if (admin && tab === "ringkasan") {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("pengguna").select("id, nama").eq("status", "aktif").order("nama");
    picRefs = (data ?? []).map((u) => ({ id: u.id, label: u.nama }));
  }
  // tahap saat ini = tahapan pertama (urut) yang belum 100%
  const tahap = pekerjaan.find((k) => k.progres < 100);
  const laporan = {
    nama: p.nama,
    outlet: p.outlet?.nama ?? "",
    progres,
    softOpening: p.tgl_soft_opening,
    grandOpening: p.target_buka,
    estimasi: estimasiRab,
    realisasi,
    tahapan: pekerjaan.map((k) => ({ nama: k.nama, progres: k.progres, pic: k.pic?.nama ?? "-" })),
    biaya: grup.map((g) => ({ kelompok: g.kelompok, estimasi: g.estimasi, realisasi: g.realisasi })),
    pembeli: p.mode_pembelian === "split" ? totalPembeli(rab) : undefined,
    setoran,
    jadwal,
    checklist,
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-5 text-white sm:p-6">
        <Link href={s.active.role === "mitra" ? "/portal/pembangunan" : "/proyek"} className="text-sm text-white/80">
          ← Semua proyek
        </Link>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{p.nama}</h1>
        <p className="text-sm text-white/90">
          {p.outlet?.nama} · {p.status === "selesai" ? "Selesai" : "Sedang berjalan"}
        </p>
        {p.status === "selesai" && (
          <p className="mt-2 inline-block rounded-full bg-green-600 px-3 py-1 text-sm font-semibold">
            🎉 Pembangunan selesai{p.selesai_at ? ` · ${formatTanggal(p.selesai_at.slice(0, 10))}` : ""} — outlet sudah beroperasi
          </p>
        )}
        {p.status !== "selesai" && tahap && (
          <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">Tahap saat ini: {tahap.nama}</p>
        )}
        <div className="mt-3 flex items-end gap-4">
          <span className="text-5xl font-extrabold">{progres}%</span>
          <div className="flex-1 pb-2">
            <div className="h-3 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{ width: `${progres}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ["Soft Opening", p.tgl_soft_opening],
            ["Grand Opening 🎉", p.target_buka],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/15 px-3 py-2">
              <p className="text-xs text-white/80">{l}</p>
              <p className="font-bold">{v ? formatTanggal(v) : "Belum ditentukan"}</p>
              {v && p.status !== "selesai" && <p className="text-xs text-white/80">{hariLagi(v)}</p>}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {admin && (
            <RowEditor
              entityKey="proyek"
              row={p as unknown as Record<string, unknown>}
              fields={PROYEK_FIELDS}
              label="✏️ Ubah data proyek"
              title="Ubah data proyek"
              className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
            />
          )}
          {admin && <SelesaiProyek id={p.id} selesai={p.status === "selesai"} />}
          <LaporanPdf data={laporan} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-matur-700 disabled:opacity-60" />
        </div>
      </section>

      <nav className="sticky top-14 z-20 -mx-4 overflow-x-auto bg-matur-50/95 px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 backdrop-blur lg:top-0">
        <div className="flex w-max gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/proyek/${p.id}?tab=${t.key}`}
              scroll={false}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${t.key === tab ? "bg-kopi-900 text-white" : "border border-matur-200 bg-white text-kopi-700"}`}
            >
              {t.label}
              {t.key === "diskusi" && komentar.length > 0 && <span className="ml-1 opacity-70">{komentar.length}</span>}
              {t.key === "desain" && menunggu.length > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-xs text-kopi-900">{menunggu.length}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {tab === "ringkasan" && (
        <>
          <section className={card}>
            <h2 className="font-bold">Tanggal Opening</h2>
            <p className="mb-3 text-xs text-stone-500">Admin dan mitra bisa mengusulkan tanggal; tanggal resmi ditentukan bersama.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["Soft Opening", "Grand Opening"] as const).map((j) => {
                const resmi = j === "Soft Opening" ? p.tgl_soft_opening : p.target_buka;
                const list = usulan.filter((u) => u.jenis === j);
                return (
                  <div key={j} className="rounded-xl border border-stone-200 p-3">
                    <p className="text-xs text-stone-500">{j}</p>
                    <p className="text-lg font-bold">{resmi ? formatTanggal(resmi) : "Belum ditentukan"}</p>
                    {list.length > 0 && (
                      <ul className="mt-2 space-y-2 border-t pt-2">
                        {list.map((u) => (
                          <li key={u.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className={`font-semibold ${u.tanggal === resmi ? "text-green-700" : ""}`}>
                              {formatTanggal(u.tanggal)}
                              {u.tanggal === resmi && " ✓"}
                            </span>
                            <span className="text-xs text-stone-500">usulan {u.nama_pengusul ?? "-"}</span>
                            <span className="ml-auto flex items-center">
                              {admin && u.tanggal !== resmi && <PakaiTanggal proyekId={p.id} jenis={j} tanggal={u.tanggal} />}
                              {(admin || u.diusulkan_oleh === s.userId) && <RowDeleter entityKey="usulan_tanggal" id={u.id} name={`Usulan ${j} ${formatTanggal(u.tanggal)}`} />}
                            </span>
                            {u.catatan && <p className="w-full text-xs text-stone-600">“{u.catatan}”</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {bisaUsul && (
                      <RowEditor entityKey="usulan_tanggal" row={null} initial={{ proyek_id: p.id, jenis: j }} fields={["jenis", "tanggal", "catatan"]} label="+ Usulkan tanggal" title={`Usulkan tanggal ${j}`} className={`mt-2 ${addBtn}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={card}>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="mr-auto font-bold">Catatan Tambahan</h2>
              {admin && (
                <RowEditor entityKey="catatan_proyek" row={null} initial={{ proyek_id: p.id, tanggal: new Date().toISOString().slice(0, 10) }} fields={["tanggal", "judul", "isi"]} label="+ Catatan" title="Tambah catatan" className={addBtn} />
              )}
            </div>
            <p className="mb-2 text-xs text-stone-500">Info tambahan & permintaan mitra, mis. kode warna cat, merek, ukuran.</p>
            {catatan.length === 0 && <p className="py-2 text-sm text-stone-400">Belum ada catatan.</p>}
            <ul className="divide-y">
              {catatan.map((c) => {
                const hex = c.isi?.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i)?.[0];
                return (
                  <li key={c.id} className="flex items-start gap-3 py-2.5">
                    {hex && <span className="mt-0.5 size-8 shrink-0 rounded-lg border border-stone-200" style={{ backgroundColor: hex }} title={hex} />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.judul}</p>
                      {c.isi && <p className="whitespace-pre-wrap break-words text-sm text-stone-700">{c.isi}</p>}
                      <p className="text-xs text-stone-400">{formatTanggal(c.tanggal)}</p>
                    </div>
                    {admin && (
                      <span className="flex shrink-0">
                        <RowEditor entityKey="catatan_proyek" row={c as unknown as Record<string, unknown>} fields={["tanggal", "judul", "isi"]} label="✏️" title="Ubah catatan" />
                        <RowDeleter entityKey="catatan_proyek" id={c.id} name={`Catatan ${c.judul}`} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {menunggu.length > 0 && (
            <Link href={`/proyek/${p.id}?tab=desain`} className="block rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-semibold">
              {menunggu.length} laporan progres menunggu persetujuan →
            </Link>
          )}

          <section className={card}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="mr-auto font-bold">Tahapan & Progres</h2>
              {admin && (
                <RowEditor entityKey="pekerjaan" row={null} initial={{ proyek_id: p.id, bobot: "1", progres: "0", urutan: String(pekerjaan.length + 1) }} fields={TAHAP_FIELDS} refs={{ pic_id: picRefs }} label="+ Tahapan" className={addBtn} />
              )}
            </div>
            {pekerjaan.length === 0 && <p className="text-sm text-stone-400">Belum ada tahapan.</p>}
            <ul className="divide-y">
              <Urutkan entityKey="pekerjaan" grup="tahapan">
              {pekerjaan.map((k) => (
                <li key={k.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{k.nama}</p>
                      <p className="text-xs text-stone-500">
                        PIC: {k.pic?.nama ?? "-"}
                        {k.tgl_mulai && ` · ${formatTanggal(k.tgl_mulai)}`}
                        {k.tgl_selesai && ` – ${formatTanggal(k.tgl_selesai)}`}
                      </p>
                    </div>
                    {admin && (
                      <span className="flex shrink-0">
                        <Pegangan id={k.id} />
                        <RowEditor entityKey="pekerjaan" row={k as unknown as Record<string, unknown>} fields={TAHAP_FIELDS} refs={{ pic_id: picRefs }} label="✏️" title={`Ubah tahapan · ${k.nama}`} />
                        <RowDeleter entityKey="pekerjaan" id={k.id} name={`Tahapan / Pekerjaan ${k.nama}`} />
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={k.progres} className="flex-1" />
                    <span className="w-10 text-right text-sm font-semibold">{k.progres}%</span>
                    {(admin || k.pic_id === s.userId) && <ReportButton proyekId={p.id} pekerjaan={{ id: k.id, nama: k.nama, progres: k.progres }} />}
                  </div>
                </li>
              ))}
              </Urutkan>
            </ul>
          </section>

          <section className={card}>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="mr-auto font-bold">Checklist Persiapan Buka</h2>
              {admin && <RowEditor entityKey="checklist_proyek" row={null} initial={{ proyek_id: p.id, urutan: String(checklist.length + 1) }} fields={["nama", "catatan", "urutan"]} label="+ Item" className={addBtn} />}
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs text-stone-500">
              <Progress value={checklist.length ? Math.round((ckSelesai / checklist.length) * 100) : 0} className="flex-1" />
              {ckSelesai}/{checklist.length} selesai
            </div>
            <ul className="divide-y">
              <Urutkan entityKey="checklist_proyek" grup="checklist">
              {checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <CentangChecklist proyekId={p.id} item={c} admin={admin} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${c.selesai ? "text-stone-400 line-through" : "font-medium"}`}>{c.nama}</p>
                    {c.catatan && <p className="text-xs text-stone-500">{c.catatan}</p>}
                  </div>
                  {admin && (
                    <span className="flex shrink-0">
                      <Pegangan id={c.id} />
                      <RowEditor entityKey="checklist_proyek" row={c as unknown as Record<string, unknown>} fields={["nama", "selesai", "catatan", "urutan"]} label="✏️" title="Ubah checklist" />
                      <RowDeleter entityKey="checklist_proyek" id={c.id} name={`Checklist ${c.nama}`} />
                    </span>
                  )}
                </li>
              ))}
              </Urutkan>
            </ul>
          </section>

          <section className={card}>
            <h2 className="mb-3 font-bold">Info Lokasi</h2>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Alamat", p.alamat],
                ["Luas tempat", p.luas],
                ["Sewa tempat", p.sewa_tempat],
                ["Kontak pemilik tempat", p.kontak_tempat],
                ["Mulai proyek", p.tgl_mulai ? formatTanggal(p.tgl_mulai) : null],
                ["Catatan", p.catatan],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-xs text-stone-500">{l}</dt>
                  <dd className="font-medium">{v || <span className="text-stone-300">—</span>}</dd>
                </div>
              ))}
            </dl>
            {p.maps_url && /^https?:\/\//.test(p.maps_url) && (
              <a href={p.maps_url} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg border border-matur-300 px-3 py-1.5 text-sm text-matur-700">
                📍 Buka di Google Maps
              </a>
            )}
            {admin && !p.alamat && <p className="mt-2 text-xs text-stone-400">Isi lewat tombol “Ubah data proyek”.</p>}
          </section>
        </>
      )}

      {tab === "jadwal" && (
        <section className={card}>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="mr-auto font-bold">Timeline Kegiatan</h2>
            {admin && <RowEditor entityKey="jadwal_proyek" row={null} initial={{ proyek_id: p.id, status: "rencana", urutan: String(jadwal.length + 1) }} fields={JADWAL_FIELDS} label="+ Kegiatan" className={addBtn} />}
          </div>
          <ol className="relative ml-2 border-l-2 border-matur-200">
            <Urutkan entityKey="jadwal_proyek" grup="jadwal">
            {jadwal.map((j) => (
              <li key={j.id} className="mb-4 ml-5">
                <span className={`absolute -left-[9px] mt-1 size-4 rounded-full border-2 border-white ${j.status === "selesai" ? "bg-green-500" : j.status === "mundur" ? "bg-red-500" : j.tgl_rencana ? "bg-matur-400" : "bg-stone-300"}`} />
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-stone-500">
                      {!j.tgl_rencana ? (
                        <span className="italic">Belum dijadwalkan</span>
                      ) : j.status === "mundur" ? (
                        <>
                          <s>{formatTanggal(j.tgl_rencana)}</s>
                          {j.tgl_realisasi && <b className="ml-1 text-red-600">→ {formatTanggal(j.tgl_realisasi)}</b>}
                        </>
                      ) : (
                        <>
                          {formatTanggal(j.tgl_rencana)}
                          {j.status === "selesai" && j.tgl_realisasi && j.tgl_realisasi !== j.tgl_rencana && ` · terlaksana ${formatTanggal(j.tgl_realisasi)}`}
                        </>
                      )}
                    </p>
                    <p className="font-medium">
                      {j.judul}
                      {j.status === "selesai" && <span className="ml-1 text-xs text-green-700">✓ selesai</span>}
                      {j.status === "mundur" && <span className="ml-1 text-xs text-red-600">mundur</span>}
                    </p>
                    {j.keterangan && <p className="text-xs text-stone-600">{j.keterangan}</p>}
                  </div>
                  {admin && (
                    <span className="flex shrink-0">
                      <Pegangan id={j.id} />
                      <RowEditor entityKey="jadwal_proyek" row={j as unknown as Record<string, unknown>} fields={JADWAL_FIELDS} label="✏️" title={`Ubah · ${j.judul}`} />
                      <RowDeleter entityKey="jadwal_proyek" id={j.id} name={`Jadwal ${j.judul}`} />
                    </span>
                  )}
                </div>
              </li>
            ))}
            </Urutkan>
            <Step date={p.tgl_soft_opening} title="Soft Opening" />
            <Step date={p.target_buka} title="Grand Opening 🎉" done={p.status === "selesai"} big />
          </ol>
          {admin && <p className="text-xs text-stone-400">Status “mundur”: isi Tanggal Realisasi dengan tanggal baru. Tahan ⋮⋮ lalu geser untuk mengubah urutan, atau isi nomor Urutan — kegiatan lain otomatis bergeser.</p>}
        </section>
      )}

      {tab === "biaya" && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Grand Total RAB" value={formatRupiah(estimasiRab)} sub="Jumlah seluruh rincian RAB aktif" />
            <Kpi label="Realisasi" value={formatRupiah(realisasi)} sub={estimasiRab ? `${Math.round((realisasi / estimasiRab) * 100)}% dari total RAB` : undefined} />
            <Kpi label="Dana Masuk Mitra" value={formatRupiah(danaMasuk)} sub={`${setoran.length} setoran`} />
            <Kpi label="Sisa Dana" value={formatRupiah(danaMasuk - realisasi)} sub="dana masuk − realisasi" warn={realisasi > danaMasuk} />
          </section>

          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-bold">Rincian Keperluan</h2>
              <RabDownload judul={`Rincian Keperluan ${p.nama}`} sub={`${p.outlet?.nama ?? ""} · Estimasi ${formatRupiah(estimasiRab)}`} items={rab} split={p.mode_pembelian === "split"} />
              <Link href={`/proyek/${p.id}/rab`} className="rounded-lg bg-matur-500 px-3 py-1.5 text-sm font-semibold text-white">
                Detail →
              </Link>
            </div>
            {rab.length === 0 && <p className="text-sm text-stone-400">Belum ada rincian keperluan.</p>}
            {rab.length > 0 && p.mode_pembelian === "split" && (
              <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
                {(["kantor", "mitra"] as const).map((o) => (
                  <Link key={o} href={`/proyek/${p.id}/rab`} className="rounded-xl bg-stone-50 px-3 py-2">
                    <p className="text-xs text-stone-500">{o === "kantor" ? "🏢 Dibeli pusat" : "🤝 Dibeli mitra"}</p>
                    <p className="font-bold">{formatRupiah(rab.filter((r) => r.dibeli_oleh === o).reduce((t, r) => t + r.harga_estimasi, 0))}</p>
                  </Link>
                ))}
              </div>
            )}
            <ul className="divide-y text-sm">
              {grup.map((g) => (
                <li key={g.kelompok} className="flex items-start gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/proyek/${p.id}/rab#${g.kelompok}`} className="font-medium hover:underline">{g.kelompok}</Link>
                    <p className="text-xs text-stone-500">{g.items.length} item · {g.items.filter((i) => i.status !== "rencana").length} dibeli/terpasang</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold">{formatRupiah(g.estimasi)}</p>
                    {g.realisasi > 0 && <p className="text-xs text-stone-500">realisasi {formatRupiah(g.realisasi)}</p>}
                  </div>
                </li>
              ))}
              {rab.length > 0 && (
                <li className="flex justify-between border-t-2 py-2 font-bold">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatRupiah(estimasiRab)}</span>
                </li>
              )}
            </ul>
          </section>

          <section className={card}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="mr-auto font-bold">Setoran Dana Mitra</h2>
              {admin && <RowEditor entityKey="setoran_mitra" row={null} initial={{ proyek_id: p.id, tanggal: new Date().toISOString().slice(0, 10) }} fields={["tanggal", "jumlah", "keterangan"]} label="+ Setoran" className={addBtn} />}
            </div>
            {setoran.length === 0 && <p className="text-sm text-stone-400">Belum ada setoran tercatat.</p>}
            <ul className="divide-y text-sm">
              {setoran.map((x) => (
                <li key={x.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatTanggal(x.tanggal)}</p>
                    {x.keterangan && <p className="text-xs text-stone-500">{x.keterangan}</p>}
                  </div>
                  <span className="font-semibold tabular-nums">{formatRupiah(x.jumlah)}</span>
                  {admin && (
                    <span className="flex shrink-0">
                      <RowEditor entityKey="setoran_mitra" row={x as unknown as Record<string, unknown>} fields={["tanggal", "jumlah", "keterangan"]} label="✏️" title="Ubah setoran" />
                      <RowDeleter entityKey="setoran_mitra" id={x.id} name={`Setoran ${formatTanggal(x.tanggal)}`} />
                    </span>
                  )}
                </li>
              ))}
              {setoran.length > 0 && (
                <li className="flex justify-between border-t-2 py-2 font-bold">
                  <span>Total dana masuk</span>
                  <span className="tabular-nums">{formatRupiah(danaMasuk)}</span>
                </li>
              )}
            </ul>
          </section>
        </>
      )}

      {tab === "desain" && (
        <>
          {menunggu.length > 0 && <Approvals proyekId={p.id} admin={admin} items={menunggu.map((f) => ({ ...f, pekerjaan: namaPekerjaan[f.pekerjaan_id] }))} />}
          <DesainGallery proyekId={p.id} admin={admin} items={desain} />
          <section className={card}>
            <h2 className="mb-3 font-bold">Galeri Progres</h2>
            {disetujui.length === 0 && <p className="text-sm text-stone-400">Belum ada foto.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {disetujui.map((f) => (
                <figure key={f.id} className="overflow-hidden rounded-xl border bg-stone-50">
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
                      <img src={f.url} alt={f.keterangan ?? ""} className="aspect-square w-full object-cover" />
                    </a>
                  )}
                  <figcaption className="p-2 text-xs">
                    <p className="font-semibold">{namaPekerjaan[f.pekerjaan_id]}{f.progres_diajukan !== null && ` · ${f.progres_diajukan}%`}</p>
                    {f.keterangan && <p className="text-stone-600">{f.keterangan}</p>}
                    <p className="text-stone-400">{formatTanggal(f.created_at, true)}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "dokumen" && <DokumenPanel proyekId={p.id} admin={admin} items={dokumen} />}
      {tab === "diskusi" && <Diskusi proyekId={p.id} userId={s.userId} admin={admin} items={komentar} />}
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-matur-200 bg-white p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-lg font-bold ${warn ? "text-red-600" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

function Step({ date, title, done, big }: { date: string | null; title: string; done?: boolean; big?: boolean }) {
  return (
    <li className="mb-4 ml-5">
      <span className={`absolute -left-[9px] mt-1 size-4 rounded-full border-2 border-white ${done ? "bg-green-500" : date ? "bg-matur-600" : "bg-stone-300"}`} />
      <p className="text-xs text-stone-500">{date ? formatTanggal(date) : <span className="italic">Belum ditentukan</span>}</p>
      <p className={big ? "font-bold" : "font-medium"}>{title}</p>
    </li>
  );
}
