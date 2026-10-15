import Page from "@/components/setoran-page";
export default function Setoran(p: {
  searchParams: Promise<{ outlet?: string; dari?: string; sampai?: string }>;
}) {
  return <Page {...p} terminal />;
}
