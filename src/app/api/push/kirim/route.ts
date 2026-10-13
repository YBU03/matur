import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Dipanggil pg_cron (Supabase) tiap 10 menit dengan daftar pengingat shift yang siap dikirim.
type Pesan = { endpoint: string; p256dh: string; auth: string; judul: string; isi: string; url: string };

export async function POST(req: Request) {
  const secret = process.env.PUSH_SECRET;
  if (!secret || req.headers.get("x-push-secret") !== secret) return new Response("ditolak", { status: 401 });
  webpush.setVapidDetails("mailto:noreply@matoer.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const { pesan } = (await req.json()) as { pesan: Pesan[] };
  const mati: string[] = [];
  let terkirim = 0;
  await Promise.all(
    (pesan ?? []).map(async (p) => {
      try {
        await webpush.sendNotification({ endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, JSON.stringify({ judul: p.judul, isi: p.isi, url: p.url }), { TTL: 3600 });
        terkirim++;
      } catch (e) {
        const kode = (e as { statusCode?: number }).statusCode;
        if (kode === 404 || kode === 410) mati.push(p.endpoint);
      }
    }),
  );
  if (mati.length) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    await db.rpc("hapus_langganan_mati", { p_secret: secret, p_endpoints: mati });
  }
  return Response.json({ terkirim, mati: mati.length });
}
