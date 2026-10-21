import { recordOnboardingAction } from "./onboarding-events";
import { archiveReceiptHtml, type ReceiptArchiveContext } from "./receipt-archive";
export type ReceiptFormat = "html" | "pdf" | "png";

// Keep the same desktop layout on phones; only the output resolution changes.
export const RECEIPT_VIEWPORT_WIDTH = 820;
export function receiptExportSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid receipt dimensions");
  }
  // Avoid blank canvases on mobile. Never silently export an unreadable receipt.
  const scale = Math.min(4, 16384 / Math.max(width, height), Math.sqrt(16_000_000 / (width * height)));
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
  const { default: html2canvas } = await import("html2canvas");
  const parsed = new DOMParser().parseFromString(html, "text/html");
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
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Receipt loading timed out")), 20_000); });
  try {
    await Promise.race([loaded, deadline]);
    const doc = frame.contentDocument!;
    await Promise.race([doc.fonts.ready, deadline]);
    await Promise.race([Promise.all(Array.from(doc.images).map(async image => {
      if (!image.complete) await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Receipt image could not be loaded"));
      });
      if (!image.naturalWidth) throw new Error("Receipt image could not be loaded");
    })), deadline]);
    const receipt = doc.querySelector<HTMLElement>(".receipt, main");
    if (!receipt) throw new Error("Receipt content is missing");
    const rect = receipt.getBoundingClientRect();
    const size = receiptExportSize(Math.max(rect.width, receipt.scrollWidth), Math.max(rect.height, receipt.scrollHeight));
    return await html2canvas(receipt, {
      ...size, backgroundColor: "#ffffff", logging: false, useCORS: true,
      windowWidth: RECEIPT_VIEWPORT_WIDTH, windowHeight: Math.max(1000, size.height),
      scrollX: 0, scrollY: 0,
    });
  } finally {
    clearTimeout(timeout);
    frame.remove();
  }
}

export async function downloadReceiptDocument(html: string, filename: string, format: ReceiptFormat, context?: ReceiptArchiveContext) {
  html = await archiveReceiptHtml(html, context);
  const basename = filename.replace(/\.(html?|pdf|png)$/i, "");
  if (format === "html") {
    saveReceiptBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${basename}.html`);
    recordOnboardingAction("receipt");
    return;
  }
  const canvas = await renderReceiptCanvas(html);
  try {
    if (format === "png") {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG export failed")), "image/png"));
      saveReceiptBlob(blob, `${basename}.png`);
    } else {
      const { jsPDF } = await import("jspdf");
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
