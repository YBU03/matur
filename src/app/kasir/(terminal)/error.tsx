"use client";

import { LayarKoneksiLambat } from "@/components/layar-koneksi-lambat";

export default function Error(p: { error: Error & { digest?: string }; reset: () => void }) {
  return <LayarKoneksiLambat {...p} />;
}
