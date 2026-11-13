import DOMPurify from 'dompurify';
import { starterReceiptSettings } from '../../../shared/starter-receipt';
const trustedStarterLogo = starterReceiptSettings<Record<string, unknown>>({}).logoBase64;

/** Download-only document. Never mutate the frozen business archive. */
export function safeReceiptDocument(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ALLOWED_TAGS: ['html','head','body','title','style','main','section','article','header','footer','div','span','p','br','hr','h1','h2','h3','h4','strong','b','em','i','small','sup','sub','table','thead','tbody','tfoot','tr','th','td','caption','colgroup','col','ul','ol','li','img'],
    ALLOWED_ATTR: ['class','id','style','lang','dir','title','src','alt','width','height','colspan','rowspan','scope'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  // Restrict images to HTTPS logos or embedded raster images. Only the exact bundled Starter SVG is trusted.
  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (src !== trustedStarterLogo && !/^https:\/\//i.test(src) && !/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) img.removeAttribute('src');
  });
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  const charset = doc.createElement('meta');
  charset.setAttribute('charset','utf-8');
  const referrer = doc.createElement('meta');
  referrer.name = 'referrer'; referrer.content = 'no-referrer';
  doc.head.prepend(charset, policy, referrer);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
