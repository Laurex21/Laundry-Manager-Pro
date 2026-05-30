import { getDemoFixture } from "./demo-data";

const LS_KEY = "laundry-demo-mode";
const SITE_KEY = "laundry-demo-site-id";

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function exitDemoMode(): void {
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(SITE_KEY);
  } catch {
    // ignore
  }
  window.location.href = "/auth";
}

function getSelectedDemoSiteId(): number | null {
  try {
    const raw = localStorage.getItem(SITE_KEY);
    if (!raw) return null;
    const siteId = Number(raw);
    return Number.isFinite(siteId) ? siteId : null;
  } catch {
    return null;
  }
}

function setSelectedDemoSiteId(siteId: number | null): void {
  try {
    if (siteId) {
      localStorage.setItem(SITE_KEY, String(siteId));
    } else {
      localStorage.removeItem(SITE_KEY);
    }
  } catch {
    // ignore
  }
}

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Intercept window.fetch so every /api/* call is served from fixtures.
function installDemoFetchPatch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url;

    // Derive pathname+search regardless of whether we got an absolute or relative URL.
    let url: string;
    try {
      url = new URL(rawUrl, window.location.origin).pathname +
            (new URL(rawUrl, window.location.origin).search || "");
    } catch {
      url = rawUrl;
    }

    // Pass through requests that are not to our own /api/ prefix.
    if (!url.startsWith("/api/")) {
      return originalFetch(input, init);
    }

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    // Logout: clear demo flag and redirect
    if (url === "/api/auth/logout" && method === "POST") {
      exitDemoMode();
      return makeJsonResponse({ ok: true });
    }

    if (url === "/api/auth/switch-site" && method === "POST") {
      const body = init?.body ? (() => { try { return JSON.parse(init.body as string); } catch { return {}; } })() : {};
      setSelectedDemoSiteId(body.siteId ? Number(body.siteId) : null);
      return makeJsonResponse({ ok: true });
    }

    if (method === "GET") {
      const fixture = getDemoFixture(url, getSelectedDemoSiteId());
      if (fixture !== undefined) {
        return makeJsonResponse(fixture);
      }
      // Unknown GET endpoint - return empty array so pages don't crash
      return makeJsonResponse([]);
    }

    // Mutations (POST/PATCH/DELETE/PUT) - return a plausible stub
    const body = init?.body ? (() => { try { return JSON.parse(init.body as string); } catch { return {}; } })() : {};
    return makeJsonResponse({ success: true, id: 9999, ...body });
  };
}

// Called once at app startup (from main.tsx)
export function initDemoMode(): void {
  // Persist ?demo=1 to localStorage
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      localStorage.setItem(LS_KEY, "1");
      if (params.has("demoSite")) {
        const siteId = Number(params.get("demoSite"));
        setSelectedDemoSiteId(Number.isFinite(siteId) && siteId > 0 ? siteId : null);
      }
      // Strip the query param without a reload
      const clean = window.location.pathname;
      window.history.replaceState(null, "", clean);
    }
  } catch {
    // ignore
  }

  if (isDemoMode()) {
    installDemoFetchPatch();
  }
}
