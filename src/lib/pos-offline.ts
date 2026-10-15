// Durable per-transaction queue. A failed write is an error: never print success for an unsaved sale.
import type { Checkout } from "./pos-actions";
export type Tertunda = {
  checkout: Checkout;
  waktu: string;
  total: number;
  nomorSementara: string;
  error?: string;
};
const DB = "matoer-pos",
  STORE = "antrean",
  META = "meta";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined")
      return reject(
        new Error("Penyimpanan offline tidak tersedia pada browser ini."),
      );
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(STORE, { keyPath: "checkout.client_id" });
      db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error("Penyimpanan perangkat gagal dibuka."));
  });
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      let result: T;
      req.onsuccess = () => {
        result = req.result;
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(result!);
      tx.onerror = () => reject(tx.error ?? new Error("Data belum tersimpan."));
      tx.onabort = () => reject(tx.error ?? new Error("Data belum tersimpan."));
    });
  } finally {
    db.close();
  }
}
const changed = () => window.dispatchEvent(new Event("matoer-antrean"));
export async function bacaAntrean(): Promise<Tertunda[]> {
  const rows = (await transaction(STORE, "readonly", (s) =>
    s.getAll(),
  )) as Tertunda[];
  return rows.sort((a, b) => a.waktu.localeCompare(b.waktu));
}
export async function simpanTertunda(t: Tertunda) {
  await transaction(STORE, "readwrite", (s) => s.put(t));
  changed();
}
export async function hapusTertunda(id: string) {
  await transaction(STORE, "readwrite", (s) => s.delete(id));
  changed();
}
export async function bacaSnapshot<T>(): Promise<T | null> {
  return (
    (await transaction(META, "readonly", (s) => s.get("snapshot"))) ?? null
  );
}
export async function simpanSnapshot(data: unknown) {
  await transaction(META, "readwrite", (s) => s.put(data, "snapshot"));
}
export async function hapusSnapshot() {
  await transaction(META, "readwrite", (s) => s.delete("snapshot"));
}
export async function migrasiAntreanLama() {
  const raw = localStorage.getItem("matoer_antrean_pos");
  if (!raw) return;
  let xs: Tertunda[];
  try {
    xs = JSON.parse(raw);
  } catch {
    throw new Error(
      "Antrean lama rusak. Jangan hapus data browser; hubungi admin.",
    );
  }
  if (!Array.isArray(xs))
    throw new Error("Format antrean lama tidak dikenali.");
  const existing = new Set(
    (await bacaAntrean()).map((x) => x.checkout.client_id),
  );
  for (const t of xs) {
    if (!t.checkout?.client_id)
      throw new Error("Ada transaksi lama tanpa identitas; hubungi admin.");
    if (existing.has(t.checkout.client_id)) continue;
    await simpanTertunda({
      ...t,
      error: t.checkout.izin_id
        ? undefined
        : "Transaksi skema lama memerlukan pemeriksaan SPV; jangan dihapus.",
    });
  }
  localStorage.removeItem("matoer_antrean_pos");
}
export const galatJaringan = (e: unknown) =>
  !navigator.onLine ||
  e instanceof TypeError ||
  /fetch|network|Failed to|koneksi/i.test(String(e));
export async function kirimCheckout(
  c: Checkout,
): Promise<{ error?: string; receipt?: import("./pos-actions").Receipt }> {
  const res = await fetch("/api/pos/transaksi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
    credentials: "same-origin",
  });
  if ([502, 503, 504].includes(res.status))
    throw new TypeError("Koneksi server terputus.");
  const data = await res.json();
  return data;
}
