import { PosAntrean } from "@/components/pos-antrean";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Matoer POS",
  applicationName: "Matoer POS",
  manifest: "/kasir.webmanifest",
};

export default function PosRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-matur-50/40">
      <PosAntrean />
      {children}
    </div>
  );
}
