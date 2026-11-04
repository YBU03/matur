/** Kanal pesanan dan metode penerimaan dana tetap disimpan terpisah. */
export const METODE_LANGSUNG = [
  ["tunai", "Tunai"],
  ["qris", "QRIS"],
  ["debit", "Debit/Kredit"],
  ["transfer", "Transfer"],
] as const;
export const METODE_PLATFORM = [
  ["grabfood", "GrabFood"],
  ["gofood", "GoFood"],
  ["shopeefood", "ShopeeFood"],
  ["tiktok", "TikTok Go"],
  ["ruma_app", "Ruma App"],
] as const;
export const LABEL_METODE_BAYAR: Record<string, string> = Object.fromEntries([
  ...METODE_LANGSUNG,
  ...METODE_PLATFORM,
  ["shopeepay", "Shopee-Pay"],
  ["split", "Split"],
]);
export const metodePlatform = (metode: string) =>
  METODE_PLATFORM.some(([kode]) => kode === metode);
export const saranMetodeKanal = (kanal: string, sebelumnya: string) =>
  metodePlatform(kanal)
    ? kanal
    : metodePlatform(sebelumnya)
      ? "tunai"
      : sebelumnya;
