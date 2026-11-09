// CORS penerima SNAP sandbox: Client Simulator ASPI mengirim langsung dari browser penguji,
// jadi hanya origin portal ASPI yang diizinkan. Tidak dipakai gateway BNI produksi.
export const SNAP_TERUSKAN = ["content-type", "authorization", "x-timestamp", "x-client-key", "x-signature", "x-partner-id", "x-external-id", "channel-id"];
const ORIGIN_ASPI = ["https://apidevportal.aspi-indonesia.or.id", "https://apidevportal.aspi-indonesia.or.id:44310"];

export function corsSnap(origin: string | null): Record<string, string> {
  if (!origin || !ORIGIN_ASPI.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": [...SNAP_TERUSKAN, "accept", "origin", "x-ip-address", "x-device-id", "x-latitude", "x-longitude", "authorization-customer"].join(", "),
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
