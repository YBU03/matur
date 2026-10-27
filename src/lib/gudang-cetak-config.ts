export type CetakGudang = {
  lebar: number;
  tinggi: number;
  rangkap: "ncr" | "salinan";
};
export const cetakGudangDefault: CetakGudang = {
  lebar: 210,
  tinggi: 297,
  rangkap: "ncr",
};
export function validCetakGudang(v: CetakGudang) {
  return (
    Number.isFinite(v.lebar) &&
    Number.isFinite(v.tinggi) &&
    v.lebar >= 180 &&
    v.lebar <= 330 &&
    v.tinggi >= 130 &&
    v.tinggi <= 420 &&
    ["ncr", "salinan"].includes(v.rangkap)
  );
}
