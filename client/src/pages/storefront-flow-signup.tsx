import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Message, storefrontApi, useStorefrontAction } from "@/components/storefront-ui";

const api = "/api/storefront/admin/flow-signup";
type Status = { state: "unavailable" | "needs_shop" } | { state: "ready" | "pending"; phone: string };
type Setup = { appId: string; configurationId: string; version: string; phone: string; attempt: string };
type Assets = { wabaId: string; phoneNumberId: string };
type Facebook = {
  init(options: { appId: string; version: string; autoLogAppEvents: false; xfbml: false }): void;
  login(callback: (response: { authResponse?: { code?: string } } | undefined) => void, options: {
    config_id: string;
    response_type: "code";
    override_default_response_type: true;
    extras: { setup: Record<string, never> };
  }): void;
};
const browser = window as Window & { FB?: Facebook };
const blocked = "La fenêtre Meta n’a pas terminé la connexion. Réessayez depuis ce navigateur.";
let sdkPromise: Promise<Facebook> | undefined;

function loadFacebookSdk() {
  if (browser.FB) return Promise.resolve(browser.FB);
  if (!sdkPromise) {
    sdkPromise = new Promise<Facebook>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/fr_FR/sdk.js";
      script.crossOrigin = "anonymous";
      script.async = true;
      const fail = () => {
        window.clearTimeout(timer);
        script.remove();
        sdkPromise = undefined;
        reject(Error("Le service de connexion de Meta n’a pas pu se charger."));
      };
      const timer = window.setTimeout(fail, 12_000);
      script.onload = () => {
        if (!browser.FB) { fail(); return; }
        window.clearTimeout(timer);
        resolve(browser.FB);
      };
      script.onerror = fail;
      document.head.append(script);
    });
  }
  return sdkPromise;
}

function openMeta(fb: Facebook, setup: Setup, signal: AbortSignal) {
  return new Promise<Assets & { authorization: string }>((resolve, reject) => {
    let assets: Assets | undefined;
    let authorization: string | undefined;
    let timer = window.setTimeout(() => fail(), 5 * 60_000);

    const cleanup = () => {
      window.removeEventListener("message", receive);
      signal.removeEventListener("abort", fail);
      window.clearTimeout(timer);
    };
    const fail = () => { cleanup(); reject(Error(blocked)); };
    const complete = () => {
      if (!assets || !authorization) return;
      cleanup();
      resolve({ ...assets, authorization });
    };
    function receive(event: MessageEvent) {
      if (!["https://www.facebook.com", "https://web.facebook.com", "https://facebook.com"].includes(event.origin)) return;
      let payload: any;
      try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; }
      catch { return; }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (["CANCEL", "ERROR", "FINISH_ONLY_WABA"].includes(payload.event)) { fail(); return; }
      if (!["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", "FINISH_GRANT_ONLY_API_ACCESS"].includes(payload.event)) return;
      const { waba_id, phone_number_id } = payload.data ?? {};
      if (typeof waba_id !== "string" || typeof phone_number_id !== "string"
        || !/^\d{1,30}$/.test(waba_id) || !/^\d{1,30}$/.test(phone_number_id)) return;
      assets = { wabaId: waba_id, phoneNumberId: phone_number_id };
      complete();
    }
    if (signal.aborted) { fail(); return; }
    window.addEventListener("message", receive);
    signal.addEventListener("abort", fail, { once: true });
    try {
      fb.login(response => {
        authorization = response?.authResponse?.code;
        window.clearTimeout(timer);
        if (!authorization) { fail(); return; }
        timer = window.setTimeout(fail, 6000);
        complete();
      }, { config_id: setup.configurationId, response_type: "code", override_default_response_type: true, extras: { setup: {} } });
    } catch { fail(); }
  });
}

export default function StorefrontFlowSignupPage() {
  const status = useQuery<Status>({ queryKey: [api], queryFn: () => storefrontApi(api), retry: false, staleTime: 0 });
  const action = useStorefrontAction();
  const [prepared, setPrepared] = useState<{ fb: Facebook; setup: Setup }>();
  const [pending, setPending] = useState<string>();
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  const prepare = () => action.run(async () => {
    const setup = await storefrontApi<Setup>(`${api}/start`, {});
    const fb = await loadFacebookSdk();
    fb.init({ appId: setup.appId, version: setup.version, autoLogAppEvents: false, xfbml: false });
    setPrepared({ setup, fb });
  });
  const connect = () => action.run(async () => {
    if (!prepared) return;
    const current = new AbortController();
    controller.current = current;
    try {
      const result = await openMeta(prepared.fb, prepared.setup, current.signal);
      const connection = await storefrontApi<{ status: "pending"; phone: string }>(`${api}/finish`, {
        ...result, attempt: prepared.setup.attempt,
      });
      setPending(connection.phone);
      void status.refetch();
    } finally {
      setPrepared(undefined);
      controller.current = undefined;
    }
  });
  const connectedPhone = pending ?? (status.data?.state === "pending" ? status.data.phone : undefined);

  return <main className="sf sf-admin">
    <section className="sf-card sf-stack">
      <a href="/boutique" className="sf-link-box">Retour à ma boutique</a>
      <h1>Connecter mon WhatsApp</h1>
      <p>Cette option permet à vos clients de remplir leur demande dans WhatsApp. Vous pouvez aussi partager le lien de votre boutique.</p>
      {connectedPhone ? <Message>Numéro {connectedPhone} vérifié. L’activation du formulaire est en attente.</Message> : <>
        {status.isPending && <Message>Vérification de votre agence…</Message>}
        {status.isError && <Message error>{status.error.message}</Message>}
        {status.data?.state === "unavailable" && <Message>La connexion Meta n’est pas encore disponible ici.</Message>}
        {status.data?.state === "needs_shop" && <Message>Enregistrez votre boutique et son numéro WhatsApp avant la connexion.</Message>}
        {status.data?.state === "ready" && <>
          <p>Numéro à connecter pour cette agence <strong>{status.data.phone}</strong></p>
          {prepared
            ? <button type="button" disabled={action.busy} onClick={connect}>{action.busy ? "Connexion en cours…" : "Ouvrir la connexion Meta"}</button>
            : <button type="button" disabled={action.busy} onClick={prepare}>{action.busy ? "Préparation…" : "Préparer la connexion"}</button>}
        </>}
        {action.error && <Message error>{action.error}</Message>}
      </>}
    </section>
  </main>;
}
