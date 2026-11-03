import { proxyBni } from "@/lib/bni-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return proxyBni(req, "callback");
}
