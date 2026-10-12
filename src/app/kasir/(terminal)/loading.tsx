export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
      <div className="size-10 animate-spin rounded-full border-4 border-matur-200 border-t-matur-500" />
    </div>
  );
}
