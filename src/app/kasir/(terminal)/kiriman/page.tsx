import { KirimanOperasionalPage } from "@/components/kiriman-operasional-page";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; id?: string }>;
}) {
  return <KirimanOperasionalPage searchParams={searchParams} terminal />;
}
