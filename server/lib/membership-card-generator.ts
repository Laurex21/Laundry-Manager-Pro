import QRCode from "qrcode";
import sharp from "sharp";

type CardCustomer = { name: string };
type CardSubscription = {
  membershipNumber: string;
  startDate: string | Date;
  expiryDate: string | Date;
  status: string;
};
type CardPlan = { name: string };
type CardBusiness = { businessName?: string | null; logoBase64?: string | null };

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

function monthYear(value: string | Date) {
  const date = new Date(typeof value === "string" ? `${value}T00:00:00Z` : value);
  return new Intl.DateTimeFormat("fr-FR", { month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function membershipQrContent(organisationId: number, membershipNumber: string, expiryDate: string | Date) {
  const expiry = typeof expiryDate === "string" ? expiryDate : expiryDate.toISOString().slice(0, 10);
  return `XPRESSPRO:${organisationId}:${membershipNumber}:${expiry}`;
}

export async function generateMembershipQrCode(content: string) {
  return QRCode.toDataURL(content, { errorCorrectionLevel: "M", margin: 1, width: 208 });
}

export function generateMembershipCardHTML(
  customer: CardCustomer,
  subscription: CardSubscription,
  plan: CardPlan,
  businessSettings: CardBusiness,
  qrCodeBase64: string,
) {
  const statusColor = subscription.status === "active" ? "#16a34a" : subscription.status === "suspended" ? "#d97706" : "#64748b";
  const logo = businessSettings.logoBase64
    ? `<img src="${escapeHtml(businessSettings.logoBase64)}" alt="" style="height:28px;max-width:88px;object-fit:contain"/>`
    : "";
  return `<!doctype html><html><body style="margin:0"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:324px;height:204px;border-radius:12px;background:linear-gradient(135deg,#0D1B4B,#1E63F0);color:#fff;font-family:Arial,sans-serif;position:relative;overflow:hidden;padding:18px">
    <div style="position:absolute;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.08);right:-55px;top:-65px"></div>
    <div style="position:absolute;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.06);left:-35px;bottom:-45px"></div>
    <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;position:relative">${logo}<span>${escapeHtml(businessSettings.businessName || "XpressPro")}</span></div>
    <div style="margin-top:16px;font-size:10px;text-transform:uppercase;letter-spacing:1.3px;color:#bfdbfe">${escapeHtml(plan.name)}</div>
    <div style="font-size:20px;font-weight:800;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(customer.name)}</div>
    <div style="font-size:12px;letter-spacing:1px;margin-top:3px">${escapeHtml(subscription.membershipNumber)}</div>
    <div style="position:absolute;left:18px;bottom:17px;font-size:9px;line-height:1.5;color:#dbeafe"><span>Depuis ${monthYear(subscription.startDate)}</span><br/><span>Expire ${monthYear(subscription.expiryDate)}</span></div>
    <div style="position:absolute;right:16px;bottom:15px;background:#fff;padding:4px;border-radius:6px"><img src="${escapeHtml(qrCodeBase64)}" alt="" width="52" height="52"/></div>
    <div style="position:absolute;right:16px;top:17px;border-radius:999px;background:${statusColor};padding:4px 8px;font-size:8px;font-weight:800;letter-spacing:.7px">${escapeHtml(subscription.status.toUpperCase())}</div>
  </div></body></html>`;
}

export async function generateMembershipCardPng(
  customer: CardCustomer,
  subscription: CardSubscription,
  plan: CardPlan,
  businessSettings: CardBusiness,
  qrCodeBase64: string,
) {
  const statusColor = subscription.status === "active" ? "#16a34a" : subscription.status === "suspended" ? "#d97706" : "#64748b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="324" height="204" viewBox="0 0 324 204">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0D1B4B"/><stop offset="1" stop-color="#1E63F0"/></linearGradient></defs>
    <rect width="324" height="204" rx="12" fill="url(#bg)"/><circle cx="315" cy="5" r="75" fill="#fff" opacity=".08"/><circle cx="5" cy="204" r="45" fill="#fff" opacity=".06"/>
    <g font-family="Arial, sans-serif" fill="#fff"><text x="18" y="33" font-size="13" font-weight="700">${escapeHtml(businessSettings.businessName || "XpressPro")}</text>
    <text x="18" y="69" font-size="10" letter-spacing="1.3" fill="#bfdbfe">${escapeHtml(plan.name.toUpperCase())}</text>
    <text x="18" y="94" font-size="20" font-weight="700">${escapeHtml(customer.name.slice(0, 24))}</text>
    <text x="18" y="114" font-size="12" letter-spacing="1">${escapeHtml(subscription.membershipNumber)}</text>
    <text x="18" y="169" font-size="9" fill="#dbeafe">Depuis ${monthYear(subscription.startDate)}</text><text x="18" y="184" font-size="9" fill="#dbeafe">Expire ${monthYear(subscription.expiryDate)}</text></g>
    <rect x="245" y="16" width="63" height="18" rx="9" fill="${statusColor}"/><text x="276.5" y="28.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" font-weight="700" fill="#fff">${escapeHtml(subscription.status.toUpperCase())}</text>
  </svg>`;
  const qr = await sharp(Buffer.from(qrCodeBase64.split(",")[1], "base64")).resize(52, 52).png().toBuffer();
  return sharp(Buffer.from(svg)).composite([{ input: qr, top: 137, left: 252 }]).png().toBuffer();
}

export async function buildMembershipCard(
  organisationId: number,
  customer: CardCustomer,
  subscription: CardSubscription,
  plan: CardPlan,
  businessSettings: CardBusiness,
) {
  const qrContent = membershipQrContent(organisationId, subscription.membershipNumber, subscription.expiryDate);
  const qrCode = await generateMembershipQrCode(qrContent);
  const html = generateMembershipCardHTML(customer, subscription, plan, businessSettings, qrCode);
  const png = await generateMembershipCardPng(customer, subscription, plan, businessSettings, qrCode);
  return { qrContent, qrCode, png, digitalCardImage: `data:image/png;base64,${png.toString("base64")}` };
}
