import type { Metadata } from "next";

export const metadata: Metadata = { title: "Matoer Staf", applicationName: "Matoer Staf", manifest: "/staf.webmanifest" };

export default function StafRoot({ children }: { children: React.ReactNode }) {
  return children;
}
