"use server";

// Aksi SDM outlet: pengaturan shift, susun & terbitkan jadwal, absen, izin, tukar shift.
// Hak akses akhirnya dijaga RLS & fungsi database (kelola_sdm / peran_di_outlet).

import { revalidatePath } from "next/cache";
import { generateSchedule } from "./jadwal/engine";
import { addDays, daysBetween, hariIni } from "./jadwal/waktu";
import { muatShift } from "./sdm";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };

const segarkan = () => {
  for (const p of [
    "/jadwal",
    "/absensi",
    "/persetujuan",
    "/dashboard",
    "/kasir/absen",
    "/kasir/jadwal",
    "/kasir/izin",
  ])
    revalidatePath(p);
  revalidatePath("/karyawan", "layout");
};
const pesan = (m: string) =>
  m.includes("row-level") || m.includes("permission")
    ? "Anda tidak punya akses untuk outlet ini."
    : m.replace(/^.*?ERROR:\s*/, "");
const tglValid = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t);
const jamValid = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// ---------- Pengaturan shift ----------
export type ShiftInput = {
  id?: string;
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
  min_orang: number;
  urutan: number;
  aktif: boolean;
};

export async function simpanShift(
  outletId: string,
  d: ShiftInput,
): Promise<Result> {
  const nama = d.nama.trim().slice(0, 40);
  if (!nama) return { error: "Nama shift wajib diisi." };
  if (!jamValid(d.jam_mulai) || !jamValid(d.jam_selesai))
    return { error: "Jam tidak valid (format JJ:MM)." };
  if (d.jam_mulai === d.jam_selesai)
    return { error: "Jam mulai dan selesai tidak boleh sama." };
  const min = Math.round(Number(d.min_orang));
  if (!(min >= 0 && min <= 50)) return { error: "Jumlah orang minimum 0–50." };
  const v = {
    nama,
    jam_mulai: d.jam_mulai,
    jam_selesai: d.jam_selesai,
    min_orang: min,
    urutan: Math.round(Number(d.urutan)) || 0,
    aktif: d.aktif,
  };
  const supabase = await supabaseServer();
  const { error, data: saved } = d.id
    ? await supabase
        .from("shift_outlet")
        .update(v)
        .eq("id", d.id)
        .eq("outlet_id", outletId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("shift_outlet")
        .insert({ ...v, outlet_id: outletId })
        .select("id")
        .single();
  if (error) return { error: pesan(error.message) };
  segarkan();
  if (!saved)
    return {
      error: "Shift tidak tersimpan. Muat ulang dan periksa akses outlet.",
    };
  return { ok: d.id ? "Shift diperbarui." : "Shift ditambahkan." };
}

/** Tiga shift standar dari jam operasional outlet (mis. "09.00 - 22.00"): pagi, tengah, malam @ 8 jam. */
export async function isiShiftStandar(outletId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: o } = await supabase
    .from("outlet")
    .select("jam_operasional")
    .eq("id", outletId)
    .single();
  const m = (o?.jam_operasional ?? "").match(
    /(\d{1,2})[.:](\d{2})\D+(\d{1,2})[.:](\d{2})/,
  );
  const buka = m ? Number(m[1]) * 60 + Number(m[2]) : 8 * 60;
  let tutup = m ? Number(m[3]) * 60 + Number(m[4]) : 22 * 60;
  if (tutup <= buka) tutup += 24 * 60;
  const durasi = Math.min(8 * 60, tutup - buka);
  const fmt = (x: number) =>
    `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  const tengah = buka + Math.round((tutup - buka - durasi) / 2 / 30) * 30;
  const baris = [
    { nama: "Pagi", mulai: buka },
    { nama: "Siang", mulai: tengah },
    { nama: "Malam", mulai: tutup - durasi },
  ].filter((b, i, a) => i === 0 || b.mulai !== a[i - 1].mulai);
  const { error } = await supabase.from("shift_outlet").insert(
    baris.map((b, i) => ({
      outlet_id: outletId,
      nama: b.nama,
      jam_mulai: fmt(b.mulai),
      jam_selesai: fmt(b.mulai + durasi),
      min_orang: 1,
      urutan: i + 1,
    })),
  );
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: `${baris.length} shift standar dibuat. Silakan sesuaikan jam & jumlah orangnya.`,
  };
}

export async function aturJatahLibur(
  outletId: string,
  penggunaId: string,
  jatah: number | null,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_jatah_libur", {
    p_uid: penggunaId,
    p_outlet: outletId,
    p_jatah: jatah,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Jatah libur disimpan." };
}

export async function aturSdm(d: {
  toleransi: number;
  jatah: number;
  izinMin: number;
  liburDibuka: boolean;
}): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_sdm", {
    p_toleransi: d.toleransi,
    p_jatah: d.jatah,
    p_izin_min: d.izinMin,
    p_libur_dibuka: d.liburDibuka,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Aturan disimpan." };
}

// ---------- Jadwal ----------
export async function generateJadwal(
  outletId: string,
  dari: string,
  sampai: string,
): Promise<
  Result & {
    kurang?: { tanggal: string; shift: string; ada: number; butuh: number }[];
  }
> {
  if (!tglValid(dari) || !tglValid(sampai) || dari > sampai)
    return { error: "Rentang tanggal tidak valid." };
  if (daysBetween(dari, sampai) > 62)
    return { error: "Maksimal 2 bulan sekali susun." };
  const s = await getSession();
  const supabase = await supabaseServer();
  const [
    { data: shifts },
    { data: staf },
    { data: ada },
    { data: izin },
    { data: lalu },
    semuaShift,
  ] = await Promise.all([
    supabase
      .from("shift_outlet")
      .select("id, nama, jam_mulai, jam_selesai, min_orang, urutan")
      .eq("outlet_id", outletId)
      .eq("aktif", true),
    supabase.rpc("staf_jadwal", { p_outlet: outletId }),
    supabase
      .from("jadwal_shift")
      .select("id, shift_id, pengguna_id, tanggal, status")
      .eq("outlet_id", outletId)
      .gte("tanggal", dari)
      .lte("tanggal", sampai),
    supabase
      .from("pengajuan_izin")
      .select("pengguna_id, tanggal")
      .eq("outlet_id", outletId)
      .eq("status", "disetujui")
      .gte("tanggal", dari)
      .lte("tanggal", sampai),
    supabase
      .from("jadwal_shift")
      .select("pengguna_id")
      .eq("outlet_id", outletId)
      .gte("tanggal", addDays(dari, -28))
      .lt("tanggal", dari),
    muatShift(outletId),
  ]);
  if (!shifts?.length)
    return { error: "Belum ada shift aktif. Atur shift di tab Shift dulu." };
  if (!staf?.length)
    return { error: "Belum ada kasir/barista yang bertugas di outlet ini." };

  // draft lama di rentang ini disusun ulang; jadwal yang sudah terbit tetap dihormati
  const { error: eHapus } = await supabase
    .from("jadwal_shift")
    .delete()
    .eq("outlet_id", outletId)
    .eq("status", "draft")
    .gte("tanggal", dari)
    .lte("tanggal", sampai);
  if (eHapus) return { error: pesan(eHapus.message) };
  const terbit = (ada ?? []).filter((j) => j.status === "terbit");
  const beban: Record<string, number> = {};
  for (const j of lalu ?? [])
    beban[j.pengguna_id] = (beban[j.pengguna_id] ?? 0) + 1;

  const hasil = generateSchedule({
    startDate: dari,
    endDate: sampai,
    hosts: (staf as { id: string; jatah_libur: number }[]).map((x) => ({
      id: x.id,
      weeklyDayOffQuota: x.jatah_libur,
    })),
    shifts: shifts.map((x) => ({
      id: x.id,
      name: x.nama,
      startTime: x.jam_mulai.slice(0, 5),
      endTime: x.jam_selesai.slice(0, 5),
      minHosts: x.min_orang,
      sortOrder: x.urutan,
    })),
    approvedLeaves: (izin ?? []).map((i) => ({
      hostId: i.pengguna_id,
      date: i.tanggal,
    })),
    existingAssignments: terbit.map((j) => {
      const sh = semuaShift.find((s) => s.id === j.shift_id);
      return {
        hostId: j.pengguna_id,
        shiftId: sh?.induk_shift_id ?? j.shift_id,
        workDate: j.tanggal,
        ...(sh?.induk_shift_id
          ? { startTime: sh.jam_mulai, endTime: sh.jam_selesai }
          : {}),
      };
    }),
    previousWorkload: beban,
  });
  const rows = hasil.assignments.map((a) => ({
    outlet_id: outletId,
    shift_id: a.shiftId,
    pengguna_id: a.hostId,
    tanggal: a.workDate,
    status: "draft",
    dibuat_oleh: s?.userId,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("jadwal_shift")
      .insert(rows.slice(i, i + 500));
    if (error) return { error: pesan(error.message) };
  }
  segarkan();
  const kurang = hasil.warnings.map((w) => ({
    tanggal: w.work_date,
    shift: w.shift_name,
    ada: w.assigned,
    butuh: w.required,
  }));
  return {
    ok: `Draft jadwal dibuat: ${rows.length} penugasan baru.${kurang.length ? ` ${kurang.length} slot kurang orang.` : ""} Periksa lalu tekan Terbitkan.`,
    kurang,
  };
}

export async function terbitkanJadwal(
  outletId: string,
  dari: string,
  sampai: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  // RPC sekaligus mengirim notifikasi ke setiap staf yang mendapat jadwal baru
  const { data, error } = await supabase.rpc("terbitkan_jadwal", {
    p_outlet: outletId,
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: data
      ? `${data} jadwal diterbitkan dan kini terlihat oleh staf (staf mendapat notifikasi).`
      : "Tidak ada draft untuk diterbitkan.",
  };
}

export async function hapusDraft(
  outletId: string,
  dari: string,
  sampai: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { error, count } = await supabase
    .from("jadwal_shift")
    .delete({ count: "exact" })
    .eq("outlet_id", outletId)
    .eq("status", "draft")
    .gte("tanggal", dari)
    .lte("tanggal", sampai);
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: `${count ?? 0} draft dihapus.` };
}

export async function tambahJadwal(
  outletId: string,
  shiftId: string,
  penggunaId: string,
  tanggal: string,
  langsungTerbit: boolean,
): Promise<Result> {
  if (!tglValid(tanggal)) return { error: "Tanggal tidak valid." };
  return kelolaJadwalHarian({
    aksi: "tambah",
    outlet_id: outletId,
    shift_id: shiftId,
    pengguna_id: penggunaId,
    tanggal,
    terbit: langsungTerbit,
  });
}

export async function hapusJadwal(id: string): Promise<Result> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("jadwal_shift")
    .select("outlet_id,versi")
    .eq("id", id)
    .maybeSingle();
  if (error || !data)
    return { error: "Jadwal tidak tersedia atau Anda tidak punya akses." };
  return kelolaJadwalHarian({
    aksi: "hapus",
    outlet_id: data.outlet_id,
    id,
    versi: data.versi,
  });
}

export async function ubahJadwal(
  id: string,
  shiftId: string,
  penggunaId: string,
): Promise<Result> {
  const db = await supabaseServer();
  const { data } = await db
    .from("jadwal_shift")
    .select("outlet_id,tanggal,versi")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "Jadwal tidak tersedia." };
  return kelolaJadwalHarian({
    aksi: "simpan",
    outlet_id: data.outlet_id,
    tanggal: data.tanggal,
    id,
    shift_id: shiftId,
    pengguna_id: penggunaId,
    versi: data.versi,
  });
}

export type HarianInput = {
  aksi:
    | "simpan"
    | "tambah"
    | "hapus"
    | "tandai"
    | "libur_masuk"
    | "libur_ganti"
    | "libur_pindah";
  outlet_id: string;
  id?: string;
  versi?: number;
  tanggal?: string;
  pengguna_id?: string;
  shift_id?: string;
  khusus?: boolean;
  mulai?: string;
  selesai?: string;
  terbit?: boolean;
  jenis?: string;
  alasan?: string;
};
export async function kelolaJadwalHarian(p: HarianInput): Promise<Result> {
  const db = await supabaseServer();
  const { error } = await db.rpc("kelola_jadwal_harian", { p });
  if (error) return { error: pesan(error.message) };
  segarkan();
  revalidatePath("/absensi/jadwal");
  return { ok: "Perubahan jadwal tersimpan." };
}

/** HRD/SPV membatalkan izin/libur (menunggu atau sudah disetujui). Jadwal yang sudah dilepas tidak kembali otomatis. */
export async function batalIzinAtasan(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("batal_izin_atasan", { p_id: id });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: "Izin/libur dibatalkan. Tambahkan lagi jadwalnya bila orang itu jadi masuk.",
  };
}

// ---------- Persetujuan ----------
export async function putusIzin(
  id: string,
  setuju: boolean,
  alasan: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("putus_izin", {
    p_id: id,
    p_setuju: setuju,
    p_alasan: alasan,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: setuju
      ? `Disetujui.${data ? ` ${data} jadwal di tanggal itu dilepas — cek slot yang kurang orang.` : ""}`
      : "Ditolak.",
  };
}

export async function putusTukar(
  id: string,
  setuju: boolean,
  alasan: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("putus_tukar", {
    p_id: id,
    p_setuju: setuju,
    p_alasan: alasan,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: setuju ? "Tukar shift disetujui, jadwal sudah ditukar." : "Ditolak.",
  };
}

/** HRD/SPV mencatat izin/sakit/libur staf (langsung disetujui, tanpa batas H-3). */
export async function catatIzinStaf(
  outletId: string,
  penggunaId: string,
  jenis: string,
  tanggal: string,
  alasan: string,
): Promise<Result> {
  if (!tglValid(tanggal)) return { error: "Tanggal tidak valid." };
  return kelolaJadwalHarian({
    aksi: "tandai",
    outlet_id: outletId,
    pengguna_id: penggunaId,
    tanggal,
    jenis,
    alasan,
  });
}

// ---------- Koreksi absensi ----------
export async function ubahAbsensi(
  id: string,
  d: { catatan: string; pulang?: string | null },
): Promise<Result> {
  const db = await supabaseServer();
  const { data: a } = await db
    .from("absensi")
    .select("masuk_at, pulang_at")
    .eq("id", id)
    .single();
  if (!a) return { error: "Absensi tidak ditemukan." };
  return editAbsensi(id, {
    masuk: a.masuk_at,
    pulang: d.pulang || a.pulang_at,
    catatan: d.catatan,
    alasan: `Koreksi: ${d.catatan.trim()}`,
  });
}

// ---------- Staf (terminal) ----------
const angka = (v: FormDataEntryValue | null) => {
  const n = v === null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Absen masuk/pulang dengan selfie + GPS (waktu server).
 * Tanpa `login`: atas nama akun yang sedang masuk (HP sendiri / terminal).
 * Dengan `login` + `pin`: staf lain absen di perangkat outlet tanpa mengganti sesi kasir yang aktif.
 */
export async function absen(form: FormData): Promise<
  Result & {
    nama?: string;
    status?: string;
    telat?: number;
    shift?: string | null;
    menit?: number;
    lokasiValid?: boolean;
  }
> {
  const s = await getSession();
  const outlet = s?.active?.outletId;
  if (!s || !outlet) return { error: "Sesi berakhir, silakan masuk lagi." };
  const jenis = form.get("jenis") === "pulang" ? "pulang" : "masuk";
  const foto = form.get("foto");
  const client = String(form.get("client_id"));
  if (!/^[0-9a-f-]{36}$/i.test(client))
    return { error: "Identitas absensi tidak valid." };
  if (
    !(foto instanceof File) ||
    !foto.size ||
    foto.size > 3 * 1024 * 1024 ||
    foto.type !== "image/jpeg"
  )
    return { error: "Ambil foto langsung melalui kamera (JPG maksimal 3 MB)." };
  const bytes = new Uint8Array(await foto.slice(0, 3).arrayBuffer());
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
    return { error: "Foto kamera tidak valid." };
  const lat = angka(form.get("lat")),
    lng = angka(form.get("lng")),
    akurasi = angka(form.get("akurasi"));
  if (
    lat === null ||
    lng === null ||
    akurasi === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(akurasi)
  )
    return { error: "Lokasi GPS wajib terbaca." };
  const db = await supabaseServer();
  const path = `${s.userId}/${hariIni()}/${jenis}-${client}.jpg`;
  const up = await db.storage
    .from("absensi")
    .upload(path, foto, { contentType: "image/jpeg" });
  if (
    up.error &&
    String(up.error.statusCode) !== "409" &&
    !/already exists|duplicate/i.test(up.error.message)
  )
    return { error: "Foto gagal diunggah. Periksa koneksi lalu coba lagi." };
  const { data, error } = await db.rpc("absen_karyawan", {
    p_outlet: outlet,
    p_jenis: jenis,
    p_foto: path,
    p_lat: lat,
    p_lng: lng,
    p_akurasi: akurasi,
    p_catatan: String(form.get("catatan") ?? ""),
    p_client: client,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  revalidatePath("/karyawan");
  const r = data as {
    status?: string;
    telat_menit?: number;
    shift?: string;
    menit?: number;
    lokasi_valid?: boolean;
  };
  return {
    ok:
      jenis === "pulang"
        ? `Absen pulang berhasil pada waktu server. Durasi kehadiran ${r.menit ?? 0} menit.`
        : r.status === "telat"
          ? `Anda terlambat ${r.telat_menit} menit.`
          : r.status === "tepat"
            ? "Anda tepat waktu. Selamat bekerja!"
            : "Kehadiran tercatat tanpa jadwal; hubungi HRD untuk pemeriksaan.",
    nama: s.nama,
    status: r.status,
    telat: r.telat_menit,
    shift: r.shift,
    menit: r.menit,
    lokasiValid: r.lokasi_valid,
  };
}

export async function ajukanIzin(
  jenis: string,
  tanggal: string,
  alasan: string,
): Promise<Result> {
  const s = await getSession();
  if (!s?.active?.outletId)
    return { error: "Sesi berakhir, silakan masuk lagi." };
  if (!tglValid(tanggal)) return { error: "Pilih tanggal." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("ajukan_izin", {
    p_outlet: s.active.outletId,
    p_jenis: jenis,
    p_tanggal: tanggal,
    p_alasan: alasan,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Pengajuan terkirim, menunggu persetujuan HRD/SPV." };
}

export async function batalIzin(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("batal_izin", { p_id: id });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Pengajuan dibatalkan." };
}

export async function ajukanTukar(
  jadwalSaya: string,
  jadwalRekan: string,
  alasan: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("ajukan_tukar", {
    p_jadwal_saya: jadwalSaya,
    p_jadwal_rekan: jadwalRekan,
    p_alasan: alasan,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: "Permintaan tukar terkirim ke rekan. Setelah rekan menerima, HRD/SPV menyetujui.",
  };
}

export async function jawabTukar(id: string, terima: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("jawab_tukar", {
    p_id: id,
    p_terima: terima,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return {
    ok: terima
      ? "Diterima, menunggu persetujuan HRD/SPV."
      : "Permintaan ditolak.",
  };
}

export async function batalTukar(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("batal_tukar", { p_id: id });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Permintaan tukar dibatalkan." };
}

export async function editAbsensi(
  id: string,
  d: {
    masuk: string;
    pulang: string | null;
    catatan: string;
    alasan: string;
    hapus?: boolean;
  },
): Promise<Result> {
  const s = await getSession();
  if (!s?.active || !["owner", "hrd", "spv"].includes(s.active.role))
    return { error: "Tidak diizinkan." };
  const db = await supabaseServer();
  const { error } = await db.rpc("edit_absensi", {
    p_id: id,
    p_masuk: d.masuk,
    p_pulang: d.pulang,
    p_catatan: d.catatan,
    p_alasan: d.alasan,
    p_hapus: !!d.hapus,
  });
  if (error) return { error: pesan(error.message) };
  segarkan();
  revalidatePath("/penggajian");
  return {
    ok: d.hapus
      ? "Absensi dihapus; rekap diperbarui. Hitung ulang draft gaji bila sudah dibuat."
      : "Absensi diperbarui. Hitung ulang draft gaji bila sudah dibuat.",
  };
}
