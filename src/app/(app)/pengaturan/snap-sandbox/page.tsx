import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { snapAction } from "@/lib/snap-sandbox-actions";
import { SNAP_EMPTY } from "@/lib/snap-sandbox-model";
import { SnapPanel } from "./panel";
export default async function SnapSandboxPage(){
 const s=await getSession();if(!s?.active||!["owner","admin_pusat","finance"].includes(s.active.role))notFound();
 const r=await snapAction('status');return <SnapPanel initial={r.state??SNAP_EMPTY} initialError={r.error} />;
}
