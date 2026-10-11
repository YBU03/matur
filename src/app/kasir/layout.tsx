import type { Metadata } from "next";

export const metadata: Metadata = { title: "Matoer POS", applicationName: "Matoer POS", manifest: "/kasir.webmanifest" };

export default function KasirRoot({ children }: { children: React.ReactNode }) {
  return children;
}
