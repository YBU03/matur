import type { ReactNode } from "react";
import { ProyekActivity } from "@/components/proyek/activity";

export default function ProyekLayout({ children }: { children: ReactNode }) {
  return <ProyekActivity>{children}</ProyekActivity>;
}
