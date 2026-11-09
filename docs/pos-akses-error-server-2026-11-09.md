# Pembuatan akses POS: error server E352 — 9 November 2026

Pembuatan akses POS outlet gagal dengan pesan umum “Perubahan belum dapat dikonfirmasi”. Permintaan POST ke aksi `aturAksesOutlet` pada produksi mengembalikan HTTP 500 dan digest `3851371084@E352`, sebelum RPC penyimpanan dipanggil.

Penyebab: `src/lib/void-actions.ts` mengekspor array `PENGATUR_VOID` dari modul `"use server"`. Modul aksi yang digabung pada halaman pengaturan POS memvalidasi ekspor tersebut sebagai fungsi dan melempar `A "use server" file can only export async functions, found object`. Memuat entry aksi dari build sebelum perbaikan juga menghasilkan E352.

Perbaikan: jadikan `PENGATUR_VOID` konstanta privat di modul yang sama. Pemeriksaan peran tetap memakai daftar yang sama; ekspor publik modul hanya fungsi async `aturVoidPin`. Tidak ada perubahan database, kredensial, riwayat, atau aturan operasional POS.

Verifikasi: TypeScript dan ESLint tanpa error; 425 tes pada 69 file lulus. Build produksi dan pemeriksaan runtime entry aksi pengaturan POS digunakan untuk memastikan error ekspor tidak muncul lagi. Pemeriksaan produksi memakai request tanpa sesi dengan outlet UUID nol: tidak membuat akun dan seharusnya mengembalikan penolakan kewenangan yang terkontrol dari database, bukan HTTP 500 E352.
