// Antrean transaksi offline di perangkat kasir (localStorage). Transaksi dikirim ulang otomatis saat online;
// aman dikirim berkali-kali karena server menolak client_id ganda (idempoten).
import type { Checkout } from "./pos-actions";

export type Tertunda = { checkout: Checkout; waktu: string; total: number; nomorSementara: string };
const KUNCI = "matoer_antrean_pos";

export function bacaAntrean(): Tertunda[] {
  try {
    return JSON.parse(localStorage.getItem(KUNCI) ?? "[]") as Tertunda[];
  } catch {
    return [];
  }
}
function tulis(xs: Tertunda[]) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(xs));
  } catch {}
  window.dispatchEvent(new Event("matoer-antrean"));
}
export function simpanTertunda(t: Tertunda) {
  tulis([...bacaAntrean().filter((x) => x.checkout.client_id !== t.checkout.client_id), t]);
}
export function hapusTertunda(clientId: string) {
  tulis(bacaAntrean().filter((x) => x.checkout.client_id !== clientId));
}

/** Kesalahan jaringan (bukan penolakan server) → transaksi boleh disimpan offline. */
export const galatJaringan = (e: unknown) => !navigator.onLine || e instanceof TypeError || /fetch|network|Failed to/i.test(String(e));
