export default function Loading() {
  return (
    <main
      className="wrap"
      style={{ padding: 64 }}
      aria-live="polite"
      aria-busy="true"
    >
      <p>Loading your club…</p>
    </main>
  );
}
