import { konteksOperasional } from "@/lib/operasional-data";
import { KasbonView } from "./view";
type RingkasanKasbon = {
  staf: { id: string; nama: string }[];
  rows: {
    id: string;
    nama: string;
    tanggal: string;
    jumlah: number;
    cicilan: number;
    catatan: string;
    terbayar: number;
    draft: number;
  }[];
};
export default async function Kasbon({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const { s, db, outlet, outlets } = await konteksOperasional(
    "kasbon",
    (await searchParams).outlet,
  );
  const { data, error } = await db.rpc("ringkasan_kasbon", {
    p_outlet: outlet.id,
  });
  if (error || !data) throw new Error("Data kasbon gagal dimuat.");
  const ringkasan = data as RingkasanKasbon;
  return (
    <KasbonView
      key={outlet.id}
      outlet={outlet}
      outlets={outlets}
      staf={ringkasan.staf}
      rows={ringkasan.rows}
      boleh={["owner", "hrd"].includes(s.active!.role)}
    />
  );
}
