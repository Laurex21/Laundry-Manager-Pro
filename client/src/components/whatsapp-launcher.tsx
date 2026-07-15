import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FaWhatsapp } from "react-icons/fa";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type WhatsAppAppPreference = "ask" | "whatsapp" | "business";

export interface WhatsAppLaunchRequest {
  phone?: string;
  text?: string;
}

const DEVICE_PREFERENCE_KEY = "xpresspro-whatsapp-app-preference";

function normalizePhone(phone?: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function standardWhatsAppUrl(request: WhatsAppLaunchRequest): string {
  const phone = normalizePhone(request.phone);
  const path = phone ? `/${phone}` : "/";
  const query = request.text ? `?text=${encodeURIComponent(request.text)}` : "";
  return `https://wa.me${path}${query}`;
}

function appQuery(request: WhatsAppLaunchRequest): string {
  const params = new URLSearchParams();
  const phone = normalizePhone(request.phone);
  if (phone) params.set("phone", phone);
  if (request.text) params.set("text", request.text);
  return params.toString();
}

function launchApp(app: Exclude<WhatsAppAppPreference, "ask">, request: WhatsAppLaunchRequest) {
  const fallbackUrl = standardWhatsAppUrl(request);
  const query = appQuery(request);
  const userAgent = navigator.userAgent || "";
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  if (isAndroid) {
    const packageName = app === "business" ? "com.whatsapp.w4b" : "com.whatsapp";
    window.location.href = `intent://send?${query}#Intent;scheme=whatsapp;package=${packageName};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
    return;
  }

  if (isIOS) {
    const scheme = app === "business" ? "whatsapp-smb" : "whatsapp";
    let appOpened = false;
    const markOpened = () => {
      if (document.hidden) appOpened = true;
    };
    document.addEventListener("visibilitychange", markOpened, { once: true });
    window.location.href = `${scheme}://send?${query}`;
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", markOpened);
      if (!appOpened && !document.hidden) window.location.href = fallbackUrl;
    }, 1400);
    return;
  }

  const opened = window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}

function readDevicePreference(): Exclude<WhatsAppAppPreference, "ask"> | null {
  try {
    const saved = window.localStorage.getItem(DEVICE_PREFERENCE_KEY);
    return saved === "whatsapp" || saved === "business" ? saved : null;
  } catch {
    return null;
  }
}

function saveDevicePreference(preference: Exclude<WhatsAppAppPreference, "ask"> | null) {
  try {
    if (preference) window.localStorage.setItem(DEVICE_PREFERENCE_KEY, preference);
    else window.localStorage.removeItem(DEVICE_PREFERENCE_KEY);
  } catch {
    // Storage can be unavailable in private browsing; the current launch still works.
  }
}

export function clearWhatsAppDevicePreference() {
  saveDevicePreference(null);
}

interface WhatsAppLauncherContextValue {
  openWhatsApp: (request: WhatsAppLaunchRequest) => void;
}

const WhatsAppLauncherContext = createContext<WhatsAppLauncherContextValue | null>(null);

export function WhatsAppLauncherProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    enabled: Boolean(user),
  });
  const [pendingRequest, setPendingRequest] = useState<WhatsAppLaunchRequest | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);

  const defaultPreference: WhatsAppAppPreference =
    settings?.whatsappAppPreference === "whatsapp" || settings?.whatsappAppPreference === "business"
      ? settings.whatsappAppPreference
      : "ask";

  const openWhatsApp = useCallback((request: WhatsAppLaunchRequest) => {
    const preference = readDevicePreference() || defaultPreference;
    if (preference === "ask") {
      setRememberChoice(false);
      setPendingRequest(request);
      return;
    }
    launchApp(preference, request);
  }, [defaultPreference]);

  const chooseApp = (preference: Exclude<WhatsAppAppPreference, "ask">) => {
    if (!pendingRequest) return;
    if (rememberChoice) saveDevicePreference(preference);
    const request = pendingRequest;
    setPendingRequest(null);
    launchApp(preference, request);
  };

  const value = useMemo(() => ({ openWhatsApp }), [openWhatsApp]);

  return (
    <WhatsAppLauncherContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(pendingRequest)} onOpenChange={(open) => !open && setPendingRequest(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-whatsapp-app-chooser">
          <DialogHeader>
            <DialogTitle>{t("choose_whatsapp_app")}</DialogTitle>
            <DialogDescription>{t("choose_whatsapp_app_description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 justify-start border-[#25D366]/40 bg-[#25D366]/5 text-left hover:bg-[#25D366]/10"
              onClick={() => chooseApp("whatsapp")}
              data-testid="button-open-whatsapp"
            >
              <FaWhatsapp className="mr-3 h-5 w-5 shrink-0 text-[#128C7E]" aria-hidden="true" />
              <span>{t("open_with_whatsapp")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 justify-start border-[#0B5C55]/40 bg-[#0B5C55]/5 text-left hover:bg-[#0B5C55]/10"
              onClick={() => chooseApp("business")}
              data-testid="button-open-whatsapp-business"
            >
              <FaWhatsapp className="mr-3 h-5 w-5 shrink-0 text-[#0B5C55]" aria-hidden="true" />
              <span>{t("open_with_whatsapp_business")}</span>
            </Button>
          </div>
          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="remember-whatsapp-choice"
              checked={rememberChoice}
              onCheckedChange={(checked) => setRememberChoice(checked === true)}
              data-testid="checkbox-remember-whatsapp-choice"
            />
            <Label htmlFor="remember-whatsapp-choice" className="cursor-pointer text-sm font-normal leading-5">
              {t("remember_whatsapp_choice")}
            </Label>
          </div>
        </DialogContent>
      </Dialog>
    </WhatsAppLauncherContext.Provider>
  );
}

export function useWhatsAppLauncher() {
  const context = useContext(WhatsAppLauncherContext);
  if (!context) throw new Error("useWhatsAppLauncher must be used within WhatsAppLauncherProvider");
  return context;
}

export function whatsappRequestFromUrl(url: string): WhatsAppLaunchRequest {
  try {
    const parsed = new URL(url, window.location.origin);
    return {
      phone: parsed.hostname === "wa.me" ? parsed.pathname.replace(/^\//, "") : undefined,
      text: parsed.searchParams.get("text") || undefined,
    };
  } catch {
    return {};
  }
}
