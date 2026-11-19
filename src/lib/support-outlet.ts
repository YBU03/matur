export type KontakSupport = {
  id: string;
  bagian: string;
  nama: string;
  nomor: string;
  aktif: boolean;
  urutan: number;
  updated_at: string;
};

/** Nomor Indonesia: 08..., 62..., atau +62... menjadi nomor tujuan wa.me. */
export function nomorSupport(input: string): string | null {
  let n = input.trim().replace(/[\s().-]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("0")) n = "62" + n.slice(1);
  return /^62[1-9][0-9]{7,12}$/.test(n) ? n : null;
}
export const tautanSupport = (nomor: string) => {
  const n = nomorSupport(nomor);
  return n ? { wa: `https://wa.me/${n}`, telepon: `tel:+${n}` } : null;
};
export const tampilNomorSupport = (n: string) =>
  `+${n.slice(0, 2)} ${n.slice(2, 5)}-${n.slice(5, 9)}-${n.slice(9)}`;
