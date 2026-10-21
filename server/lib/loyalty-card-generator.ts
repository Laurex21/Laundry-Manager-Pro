import QRCode from "qrcode";
import sharp from "sharp";

function escapeXml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export function loyaltyCardIdentifier(organisationId: number, customerId: number) {
  return `XPRESSPRO-LOYALTY:${organisationId}:${customerId}`;
}

export async function buildLoyaltyCard(customer: { id: number; name: string; loyaltyTier: string }, organisationId: number, businessName: string) {
  const identifier = loyaltyCardIdentifier(organisationId, customer.id);
  const qr = await QRCode.toBuffer(identifier, { errorCorrectionLevel: "M", margin: 1, width: 180 });
  const safeName = escapeXml(customer.name.slice(0, 25));
  const safeBusiness = escapeXml(businessName.slice(0, 32));
  const tier = escapeXml(customer.loyaltyTier.toUpperCase().slice(0, 16));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="648" height="408" viewBox="0 0 648 408">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0D1B4B"/><stop offset="1" stop-color="#1E63F0"/></linearGradient></defs>
    <rect width="648" height="408" rx="24" fill="url(#bg)"/>
    <circle cx="628" cy="0" r="140" fill="#fff" opacity=".07"/><circle cx="0" cy="408" r="100" fill="#fff" opacity=".05"/>
    <g font-family="Arial, sans-serif" fill="#fff">
      <text x="36" y="64" font-size="27" font-weight="700">${safeBusiness}</text>
      <text x="36" y="137" font-size="21" letter-spacing="3" fill="#bfdbfe">CARTE DE FIDÉLITÉ</text>
      <text x="36" y="192" font-size="37" font-weight="700">${safeName}</text>
      <text x="36" y="230" font-size="22">N° ${customer.id}</text>
      <text x="36" y="352" font-size="18" fill="#dbeafe">Présentez cette carte lors de votre visite</text>
    </g>
    <rect x="36" y="262" width="150" height="43" rx="21" fill="#fff" opacity=".16"/>
    <text x="111" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#fff">${tier}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).composite([{ input: await sharp(qr).resize(112, 112).png().toBuffer(), left: 500, top: 258 }]).png().toBuffer();
}
