// Dipakai server & client: palet kategori (urutan tetap, tervalidasi CVD) dan format angka.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const SINGLE = "#eb6834";

const nf = new Intl.NumberFormat("id-ID");
export const angka = (n: number) => nf.format(n);
export const rupiah = (n: number) => `Rp ${nf.format(Math.round(n))}`;
export const ringkas = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1).replace(".", ",")} M` : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(n);
