export function registerPwa() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    if (window.self !== window.top) return;
  } catch {
    return;
  }

  void navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => {
      const pushUrls = () => {
        const worker = reg.active;
        if (!worker) return;
        const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
        urls.push(window.location.href);
        worker.postMessage({ type: "CACHE_URLS", urls });
      };
      if (reg.active) pushUrls();
      else {
        navigator.serviceWorker.addEventListener("controllerchange", pushUrls, { once: true });
      }
      window.setTimeout(pushUrls, 2500);
    })
    .catch(() => {
      /* ignore */
    });
}
