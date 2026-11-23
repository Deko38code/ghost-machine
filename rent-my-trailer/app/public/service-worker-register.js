if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    }).catch((error) => {
      /* Keep sign-in and booking flows usable if SW install is blocked. */
      console.warn("Service worker registration failed", error);
    });
  });
}
