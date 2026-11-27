import { newTeamInvitation } from "@shared/team-invitation";
import { DEMO_SITES } from "./demo-data";

const keyPrefix = "xpresspro-demo-invitation:";
const demoToken = /^demo-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export const isDemoInvitation = (token: string) => demoToken.test(token);

type DemoInvitation = {
  id: string;
  token: string;
  siteId: number;
  siteName: string;
  identifier: string;
  notificationPhone: string | null;
  role: "manager" | "operator";
  expiresAt: string;
  status: "pending" | "accepted";
};

export function readDemoInvitation(token: string): DemoInvitation | null {
  if (!isDemoInvitation(token)) return null;
  const key = keyPrefix + token;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const inv: DemoInvitation = JSON.parse(raw);
      if (inv.token === token && Date.parse(inv.expiresAt) > Date.now() &&
          (inv.status === "pending" || inv.status === "accepted")) return inv;
    } catch { /* Discard stale demo data. */ }
    localStorage.removeItem(key);
  }
  return null;
}

export function acceptDemoInvitation(token: string) {
  const inv = readDemoInvitation(token);
  if (!inv || inv.status !== "pending") return false;
  localStorage.setItem(keyPrefix + token, JSON.stringify({ ...inv, status: "accepted" }));
  return true;
}

export function clearDemoInvitations() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(keyPrefix)) localStorage.removeItem(key);
  }
}

export function demoInvitationResponse(path: string, method: string, body?: BodyInit | null) {
  if (path === "/api/invitations" && method === "POST") {
    let data: unknown;
    try { data = JSON.parse(String(body)); } catch { return Response.json({}, { status: 400 }); }
    const parsed = newTeamInvitation.safeParse(data);
    const site = parsed.success && DEMO_SITES.find(site => site.id === parsed.data.siteId);
    if (!parsed.success || !site) return Response.json({}, { status: 400 });
    const token = "demo-" + crypto.randomUUID();
    const inv: DemoInvitation = { ...parsed.data, token, id: token, siteName: site.name,
      status: "pending", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
    localStorage.setItem(keyPrefix + token, JSON.stringify(inv));
    return Response.json(inv, { status: 201 });
  }
  if (path === "/api/invitations/pending" && method === "GET") {
    const invitations = Object.keys(localStorage).filter(k => k.startsWith(keyPrefix))
      .map(k => readDemoInvitation(k.slice(keyPrefix.length))).filter(inv => inv?.status === "pending");
    return Response.json(invitations);
  }
  if (method === "DELETE" && path.startsWith("/api/invitations/")) {
    const token = path.slice("/api/invitations/".length);
    if (readDemoInvitation(token)?.status !== "pending") return Response.json({}, { status: 404 });
    localStorage.removeItem(keyPrefix + token);
    return Response.json({ success: true });
  }
}
