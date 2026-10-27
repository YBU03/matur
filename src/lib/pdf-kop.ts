// Bantuan PDF (browser): gambar dari /public sebagai data URL, dan kop surat CV. Hazna Berkah Indonesia.
import type { jsPDF } from "jspdf";

export async function gambar(src: string) {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Aset gambar tidak dapat dimuat.");
  const blob = await res.blob();
  const url = await new Promise<string>((ok, gagal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => gagal(new Error("Aset gambar tidak dapat dibaca."));
    r.readAsDataURL(blob);
  });
  const img = await new Promise<HTMLImageElement>((ok, gagal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => gagal(new Error("Format gambar tidak dapat dimuat."));
    i.src = url;
  });
  return { url, w: img.naturalWidth, h: img.naturalHeight };
}

export type Kop = {
  logo_url?: string;
  nama: string;
  alamat: string | null;
  email: string | null;
  telepon: string | null;
};

/** Gambar kop di atas halaman; mengembalikan posisi y di bawah garis kop. */
export async function kopSurat(doc: jsPDF, pt: Kop) {
  const W = doc.internal.pageSize.getWidth();
  const logo = await gambar("/brand/hazna-logo.png");
  doc.addImage(logo.url, "PNG", 14, 8, (18 * logo.w) / logo.h, 18);
  let y = 14;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(13)
    .text(pt.nama.toUpperCase(), W / 2 + 8, y, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  if (pt.alamat) doc.text(pt.alamat, W / 2 + 8, (y += 5), { align: "center" });
  if (pt.email || pt.telepon)
    doc.text(
      `Email: ${pt.email ?? "-"}  Telp: ${pt.telepon ?? "-"}`,
      W / 2 + 8,
      (y += 4),
      { align: "center" },
    );
  y = Math.max(y, 26) + 3;
  doc.setLineWidth(0.6).line(14, y, W - 14, y);
  return y;
}

export function unduh(doc: jsPDF, nama: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(doc.output("blob"));
  a.download = `${nama}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
