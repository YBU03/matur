import { minta } from "@/components/dialog-tanya";

type HasilAlasan = { error?: string; ok?: string; perluAlasan?: boolean };

/** Jalankan aksi; bila server minta alasan (kas shift final), tanyakan alasan lalu ulangi sekali. */
export async function denganAlasan<T extends HasilAlasan>(fn: (alasan?: string) => Promise<T>): Promise<T> {
  const r = await fn();
  if (!r.perluAlasan) return r;
  const alasan = await minta("Kas shift ini sudah final. Perubahan nominal, sumber dana, atau hapus akan menyesuaikan kas seharusnya dan tercatat di riwayat perbaikan. Tulis alasannya:", {
    judul: "Alasan perbaikan",
    placeholder: "mis. salah ketik nominal, nota asli Rp…",
    wajib: true,
    ya: "Simpan perbaikan",
  });
  if (!alasan) return { ...r, error: "Perbaikan dibatalkan.", perluAlasan: false };
  return fn(alasan);
}
