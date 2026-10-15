"use server";

// Penggajian staf outlet: komponen gaji, hitung dari absensi, ubah slip, finalkan (→ beban "Biaya Gaji" laporan).
import { revalidatePath } from "next/cache";
import {
  hitungJamGaji,
  aturanGaji,
  hitungSlip,
  KOMPONEN_KOSONG,
  totalSlip,
  type Baris,
  type Komponen,
} from "./gaji";
import { hitungRekap } from "./jadwal/rekap";
import { muatAbsensi, muatIzin, muatJadwal, muatShift, muatStaf } from "./sdm";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

type Result = { error?: string; ok?: string };
const pesan = (m: string) =>
  m.includes("row-level") || m.includes("permission")
    ? "Hanya Owner/HRD yang bisa mengubah penggajian."
    : m.replace(/^.*?ERROR:\s*/, "");
const segarkan = () => {
  revalidatePath("/penggajian");
  revalidatePath("/kasir/slip");
};
const LABEL_PERAN: Record<string, string> = {
  kasir: "Kasir",
  barista: "Barista",
  spv: "SPV",
};

async function boleh() {
  const s = await getSession();
  return !!s?.active && ["owner", "hrd"].includes(s.active.role);
}

export async function simpanGajiStaf(
  uid: string,
  k: Komponen & {
    bank?: string | null;
    no_rekening?: string | null;
    atas_nama?: string | null;
  },
): Promise<Result> {
  if (!(await boleh())) return { error: "Hanya Owner/HRD." };
  let aturan;
  try {
    aturan = aturanGaji(k.aturan);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const angka = (v: unknown) =>
    Math.max(Math.round(Number(String(v).replace(/[^\d]/g, "")) || 0), 0);
  const supabase = await supabaseServer();
  const { error } = await supabase.from("gaji_staf").upsert({
    aturan,
    pengguna_id: uid,
    gaji_pokok: angka(k.gaji_pokok),
    tunjangan: angka(k.tunjangan),
    uang_makan: angka(k.uang_makan),
    potongan_telat: angka(k.potongan_telat),
    potongan_alpa: angka(k.potongan_alpa),
    bank: k.bank?.trim() || null,
    no_rekening: k.no_rekening?.trim() || null,
    atas_nama: k.atas_nama?.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Komponen gaji disimpan." };
}

/** Buat/ulang hitung draft penggajian outlet sebulan dari absensi. Baris manual (bonus, kasbon, …) tetap dipertahankan. */
export async function hitungPenggajian(
  outletId: string,
  bulan: string,
): Promise<Result> {
  if (!(await boleh())) return { error: "Hanya Owner/HRD." };
  if (!/^\d{4}-\d{2}$/.test(bulan)) return { error: "Bulan tidak valid." };
  const supabase = await supabaseServer();
  const periode = `${bulan}-01`;
  const akhir = new Date(
    Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);

  let { data: g } = await supabase
    .from("penggajian")
    .select("id, status")
    .eq("mode", "asli")
    .eq("outlet_id", outletId)
    .eq("periode", periode)
    .maybeSingle();
  if (g?.status === "final")
    return {
      error:
        "Penggajian bulan ini sudah final. Buka dulu untuk menghitung ulang.",
    };
  if (!g) {
    const { data, error } = await supabase
      .from("penggajian")
      .insert({ outlet_id: outletId, periode })
      .select("id, status")
      .single();
    if (error) return { error: pesan(error.message) };
    g = data;
  }

  const [shifts, staf, jadwal, izin, absensi] = await Promise.all([
    muatShift(outletId),
    muatStaf(outletId),
    muatJadwal(outletId, periode, akhir),
    muatIzin(outletId, periode, akhir, { status: ["disetujui"] }),
    muatAbsensi(outletId, periode, akhir),
  ]);
  const rekap = hitungRekap({
    shifts,
    jadwal: jadwal.filter((j) => j.status === "terbit"),
    absensi,
    izin,
  });
  const ids = [
    ...new Set([
      ...staf.map((x) => x.id),
      ...rekap.ringkas.map((r) => r.pengguna_id),
    ]),
  ];
  if (!ids.length)
    return { error: "Belum ada staf (kasir/barista/SPV) di outlet ini." };

  const [{ data: komp }, { data: lama }, { data: org }] = await Promise.all([
    supabase.from("gaji_staf").select("*").in("pengguna_id", ids),
    supabase
      .from("slip_gaji")
      .select("pengguna_id, pendapatan, potongan")
      .eq("penggajian_id", g!.id),
    supabase.from("pengguna").select("id, nama").in("id", ids),
  ]);
  const kmap = new Map((komp ?? []).map((x) => [x.pengguna_id, x]));
  const lmap = new Map((lama ?? []).map((x) => [x.pengguna_id, x]));
  const nama = new Map([
    ...(org ?? []).map((u) => [u.id, u.nama] as const),
    ...staf.map((x) => [x.id, x.nama] as const),
  ]);

  const baris = ids.map((uid) => {
    const r = rekap.ringkas.find((x) => x.pengguna_id === uid);
    const h = {
      hadir: r?.hadir ?? 0,
      telat: r?.telat ?? 0,
      menitTelat: r?.menitTelat ?? 0,
      tidakAbsen: r?.tidakAbsen ?? 0,
      izin: r?.izin ?? 0,
      menitKerja: r?.menitKerja ?? 0,
    };
    const k = kmap.get(uid);
    const jam = hitungJamGaji(
      k ? { ...KOMPONEN_KOSONG, ...k } : KOMPONEN_KOSONG,
      rekap.baris.filter((b) => b.pengguna_id === uid),
    );
    const auto = hitungSlip(
      k ? { ...KOMPONEN_KOSONG, ...k } : KOMPONEN_KOSONG,
      h,
    );
    const manual = (x?: Baris[]) => (x ?? []).filter((b) => b.manual);
    const pendapatan = [
      ...auto.pendapatan,
      ...(jam.nominal_lembur > 0
        ? [
            {
              nama: `Lembur (${jam.menit_lembur} menit)`,
              jumlah: jam.nominal_lembur,
            },
          ]
        : []),
      ...manual(lmap.get(uid)?.pendapatan as Baris[]),
    ];
    const potongan = [
      ...auto.potongan,
      ...manual(lmap.get(uid)?.potongan as Baris[]),
    ];
    const peran = staf.find((x) => x.id === uid)?.peran ?? "";
    return {
      penggajian_id: g!.id,
      pengguna_id: uid,
      nama: nama.get(uid) ?? "-",
      jabatan:
        peran
          .split(",")
          .map((p) => LABEL_PERAN[p] ?? p)
          .filter(Boolean)
          .join(" / ") || null,
      hadir: h.hadir,
      telat: h.telat,
      menit_telat: h.menitTelat,
      tidak_absen: h.tidakAbsen,
      izin: h.izin,
      menit_kerja: jam.menit_kerja,
      hitungan_jam: jam,
      pendapatan,
      potongan,
      total: totalSlip(pendapatan, potongan),
      rekening: k?.no_rekening
        ? [k.bank, k.no_rekening, k.atas_nama && `a.n. ${k.atas_nama}`]
            .filter(Boolean)
            .join(" ")
        : null,
    };
  });
  const { error } = await supabase.rpc("simpan_draft_gaji", {
    p_id: g!.id,
    p_rows: baris,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: `${baris.length} slip dihitung dari absensi. Periksa, tambah bonus/potongan bila perlu, lalu finalkan.`,
  };
}

/** Simpan baris tambahan (manual) satu slip; baris otomatis tetap dari hitungan absensi. */
export async function ubahSlip(
  slipId: string,
  tambahPendapatan: Baris[],
  tambahPotongan: Baris[],
): Promise<Result> {
  if (!(await boleh())) return { error: "Hanya Owner/HRD." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("ubah_manual_slip", {
    p_slip: slipId,
    p_pendapatan: tambahPendapatan,
    p_potongan: tambahPotongan,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Slip diperbarui." };
}

export async function finalkanPenggajian(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("finalkan_penggajian", {
    p_id: id,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  revalidatePath("/laporan/proyeksi");
  return {
    ok: `Gaji final. Total ${new Intl.NumberFormat("id-ID").format(Number(data))} dibayarkan bersih. Beban gaji mencakup cicilan kasbon yang ditahan.`,
  };
}

export async function bukaPenggajian(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("buka_penggajian", { p_id: id });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: "Penggajian dibuka kembali (draft). Biaya gaji di laporan ditarik sementara.",
  };
}
