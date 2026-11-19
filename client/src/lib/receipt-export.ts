import { safeReceiptDocument } from "./receipt-safety";
import { receiptQuantity } from "./receipt-quantity";
import { recordOnboardingAction } from "./onboarding-events";
import { archiveReceiptHtml, type ReceiptArchiveContext } from "./receipt-archive";
import { waitForReceiptOperation, withReceiptTimeout } from "./receipt-request";
export type ReceiptFormat = "html" | "pdf" | "png";

// Apply display-only corrections after reading the frozen archive too. Never
// rewrite the stored receipt, its amounts, identity, dates or payment history.
export function normalizeReceiptPresentation(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.querySelector(".receipt .items-table")) return html;
  const french = /Reçu de|Résumé des services|Qté/i.test(doc.body.textContent || "");
  doc.querySelectorAll(".items-table tbody tr td:nth-child(2), .checklist-table td").forEach(cell => {
    const text = Array.from(cell.childNodes).find(node => node.nodeType === 3 && /^\s*\d+(?:\.\d+)?\s/.test(node.textContent || ""));
    if (text) text.textContent = (text.textContent || "").replace(/^(\s*)(\d+(?:\.\d+)?)(?=\s)/, (_match, space, quantity) => space + receiptQuantity(quantity, french ? "fr" : "en"));
  });
  const style = doc.createElement("style");
  style.textContent = ".receipt{font-family:Arial,Helvetica,sans-serif;line-height:1.45}.receipt .items-table,.receipt .checklist-table{line-height:1.45}.receipt .deposit-badge{line-height:1.4}";
  doc.head.appendChild(style);
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

// Keep the same desktop layout on phones; only the output resolution changes.
export const RECEIPT_VIEWPORT_WIDTH = 820;
export function receiptExportSize(width: number, height: number, mobile = false) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid receipt dimensions");
  }
  // Avoid blank canvases on mobile. Never silently export an unreadable receipt.
  // 2x retains readable text on phones while quartering the usual 4x bitmap.
  const scale = Math.min(mobile ? 2 : 4, 16384 / Math.max(width, height), Math.sqrt(16_000_000 / (width * height)));
  if (scale < 2) throw new Error("RECEIPT_TOO_LARGE");
  return { width: Math.ceil(width), height: Math.ceil(height), scale };
}

export function saveReceiptBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Mobile browsers may start reading the download after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** One rendering shared by PDF and PNG: no print CSS, pagination or JPEG compression. */
export async function renderReceiptCanvas(html: string): Promise<HTMLCanvasElement> {
  return withReceiptTimeout(signal => renderReceiptCanvasWithinDeadline(html, signal), 30_000);
}

async function renderReceiptCanvasWithinDeadline(html: string, signal: AbortSignal): Promise<HTMLCanvasElement> {
  const wait = <T,>(operation: Promise<T>) => waitForReceiptOperation(operation, signal);
  const { default: html2canvas } = await wait(import("html2canvas"));
  const parsed = new DOMParser().parseFromString(safeReceiptDocument(html), "text/html");
  parsed.querySelectorAll("script, iframe, object, embed, base, meta[http-equiv], .no-print").forEach(node => node.remove());
  parsed.querySelectorAll("*").forEach(node => {
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.startsWith("on")) node.removeAttribute(attr.name);
    }
  });
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${RECEIPT_VIEWPORT_WIDTH}px;height:1000px;border:0;pointer-events:none`;
  // No scripts execute in this isolated document, including subscriber auto-print scripts.
  const loaded = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error("Receipt could not be loaded"));
  });
  frame.srcdoc = parsed.documentElement.outerHTML;
  document.body.appendChild(frame);
  try {
    await wait(loaded);
    const doc = frame.contentDocument!;
    await wait(doc.fonts.ready);
    await wait(Promise.all(Array.from(doc.images).map(async image => {
      if (!image.complete) await wait(new Promise<void>(resolve => {
        image.onload = image.onerror = () => resolve();
      }));
      if (!image.naturalWidth) {
        // A removed/invalid logo must not prevent access to the receipt. Make
        // the missing image explicit in the export; never change its archive.
        const placeholder = doc.createElement("span");
        placeholder.textContent = `[${image.alt || "Image"} — unavailable / indisponible]`;
        placeholder.style.cssText = "font:12px Arial;color:#64748b";
        image.replaceWith(placeholder);
      }
    })));
    const receipt = doc.querySelector<HTMLElement>(".receipt, main");
    if (!receipt) throw new Error("Receipt content is missing");
    // Export the receipt itself at the document origin, without page chrome.
    // Non-zero offsets are scaled twice by html2canvas's foreign-object path.
    doc.body.style.padding = "0";
    doc.body.style.margin = "0";
    receipt.style.margin = "0";
    const rect = receipt.getBoundingClientRect();
    const mobile = window.matchMedia("(max-width: 600px), (pointer: coarse)").matches;
    const size = receiptExportSize(Math.max(rect.width, receipt.scrollWidth), Math.max(rect.height, receipt.scrollHeight), mobile);
    return await wait(html2canvas(receipt, {
      ...size, backgroundColor: "#ffffff", logging: false, useCORS: true,
      // Let the browser lay out and paint text, borders, flex and grid together.
      // The manual canvas text renderer shifts baselines relative to the HTML.
      foreignObjectRendering: true,
      windowWidth: RECEIPT_VIEWPORT_WIDTH, windowHeight: Math.max(1000, size.height),
      scrollX: 0, scrollY: 0,
    }).then(canvas => {
      if (signal.aborted) {
        canvas.width = canvas.height = 0;
        throw signal.reason;
      }
      return canvas;
    }));
  } finally {
    frame.onload = frame.onerror = null;
    frame.remove();
  }
}

export async function downloadReceiptDocument(html: string, filename: string, format: ReceiptFormat, context?: ReceiptArchiveContext) {
  html = safeReceiptDocument(normalizeReceiptPresentation(await archiveReceiptHtml(html, context)));
  const basename = filename.replace(/\.(html?|pdf|png)$/i, "");
  if (format === "html") {
    saveReceiptBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${basename}.html`);
    recordOnboardingAction("receipt");
    return;
  }
  const canvas = await renderReceiptCanvas(html);
  try {
    if (format === "png") {
      const blob = await withReceiptTimeout(() => new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG export failed")), "image/png")));
      saveReceiptBlob(blob, `${basename}.png`);
    } else {
      const { jsPDF } = await withReceiptTimeout(() => import("jspdf"));
      // The page follows the HTML proportions, including long receipts, with no clipping.
      const width = 510; // 680 CSS pixels at 96 dpi, in PDF points.
      const height = width * canvas.height / canvas.width;
      const pdf = new jsPDF({ unit: "pt", format: [width, height], orientation: height >= width ? "portrait" : "landscape", compress: true });
      pdf.addImage(canvas, "PNG", 0, 0, width, height, undefined, "FAST");
      saveReceiptBlob(pdf.output("blob"), `${basename}.pdf`);
    }
    recordOnboardingAction("receipt");
  } finally {
    canvas.width = canvas.height = 0;
  }
}
