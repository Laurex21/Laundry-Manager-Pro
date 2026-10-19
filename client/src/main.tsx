import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import i18n from "./lib/i18n";
import { initDemoMode } from "./lib/demo-mode";
import { trackAppVisit } from "./lib/analytics";

// Must run before React renders so fetch is patched before any queries fire.
initDemoMode();

function syncDocumentLanguage(language: string) {
  document.documentElement.lang = language.split("-")[0] || "en";
}

syncDocumentLanguage(i18n.resolvedLanguage || i18n.language);
i18n.on("languageChanged", syncDocumentLanguage);

createRoot(document.getElementById("root")!).render(<App />);

const recordAppVisit = () => trackAppVisit();
if (document.readyState === "complete") {
  recordAppVisit();
} else {
  window.addEventListener("load", recordAppVisit, { once: true });
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("XpressPro service worker registration failed", error);
    });
  });
}
