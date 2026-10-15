import { KirimanOperasionalPage } from "@/components/kiriman-operasional-page";
export default function Page(p: {
  searchParams: Promise<{ outlet?: string; id?: string }>;
}) {
  return <KirimanOperasionalPage {...p} />;
}
