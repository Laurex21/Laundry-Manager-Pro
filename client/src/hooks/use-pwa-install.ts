import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isIos = useMemo(() => /iphone|ipad|ipod/i.test(userAgent)
    || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1), [userAgent]);
  const isAndroid = useMemo(() => /android/i.test(userAgent), [userAgent]);
  const isSafari = useMemo(() => /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(userAgent), [userAgent]);
  const isMacSafari = useMemo(() => /macintosh/i.test(userAgent) && isSafari && !isIos, [userAgent, isSafari, isIos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInstalled(window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
    return choice.outcome === "accepted";
  };

  return { canInstall: Boolean(installPrompt), install, installed, isIos, isAndroid, isMacSafari, isIosSafari: isIos && isSafari };
}
