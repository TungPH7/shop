// Lazy-loaded via route.lazy() → ships in its own chunk. Open the network tab
// (or read the `vite build` manifest) and this route arrives as a separate file.
export function AboutRoute() {
  return (
    <section>
      <h2>About</h2>
      <p>
        This route is loaded on demand. It is not part of the initial bundle — the browser only
        downloads it the first time you navigate here.
      </p>
    </section>
  );
}
