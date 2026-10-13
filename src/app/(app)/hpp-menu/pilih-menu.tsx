"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { hubungkanHpp } from "@/lib/hpp-actions";

export function PilihMenu({ id, value, opsi }: { id: string; value: string | null; opsi: { id: string; nama: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      disabled={pending}
      value={value ?? ""}
      onChange={(e) =>
        start(async () => {
          const r = await hubungkanHpp(id, e.target.value || null);
          if (r.error) alert(r.error);
          router.refresh();
        })
      }
      className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
    >
      <option value="">— belum terhubung —</option>
      {opsi.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nama}
        </option>
      ))}
    </select>
  );
}
