import SetoranPage from "@/components/setoran-page";
export default function Page(p: {
  searchParams: Promise<{ outlet?: string; dari?: string; sampai?: string }>;
}) {
  return <SetoranPage {...p} />;
}
