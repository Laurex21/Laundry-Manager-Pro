import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import i18n from "./lib/i18n";
import { initDemoMode } from "./lib/demo-mode";

// Must run before React renders so fetch is patched before any queries fire.
initDemoMode();

function syncDocumentLanguage(language: string) {
  document.documentElement.lang = language.split("-")[0] || "en";
}

syncDocumentLanguage(i18n.resolvedLanguage || i18n.language);
i18n.on("languageChanged", syncDocumentLanguage);

createRoot(document.getElementById("root")!).render(<App />);
