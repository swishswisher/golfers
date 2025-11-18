export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-sand-100">
      <div className="container-page flex flex-col gap-4 py-6 text-xs text-black/60 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Golfers Clubline · Concept MVP for a multi-tenant golf club
          engagement platform.
        </p>
        <p className="flex flex-wrap gap-2">
          <span>Demo designed &amp; built by David Akim.</span>
          <span className="hidden sm:inline">·</span>
          <span>Contact: your.email@example.com</span>
        </p>
      </div>
    </footer>
  );
}

