const rupiah = new Intl.NumberFormat("id-ID");

/** Format laporan acuan: "Rp 1.234", nol ditulis "Rp -", negatif dalam kurung. */
export function formatRupiah(n: number): string {
  if (!n) return "Rp -";
  const s = `Rp ${rupiah.format(Math.abs(Math.round(n)))}`;
  return n < 0 ? `(${s})` : s;
}

export function formatTanggal(iso: string, withTime = false): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" } : {}),
  });
}
