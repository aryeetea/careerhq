export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
