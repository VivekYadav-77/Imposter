export default function Loading() {
  return (
    <main className="route-state" aria-busy="true">
      <div className="route-loader" />
      <p>Opening the case file…</p>
    </main>
  );
}
