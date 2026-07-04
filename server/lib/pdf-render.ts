import { execSync } from "child_process";
import type { Browser } from "puppeteer-core";

let cachedExecutablePath: string | null = null;

function getChromiumExecutablePath(): string {
  if (cachedExecutablePath) return cachedExecutablePath;
  const candidates = ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"];
  for (const bin of candidates) {
    try {
      const resolved = execSync(`which ${bin}`, { encoding: "utf8" }).trim();
      if (resolved) {
        cachedExecutablePath = resolved;
        return resolved;
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error("No Chromium executable found on this system for PDF rendering");
}

let browserPromise: Promise<Browser> | null = null;
const A4_WIDTH_MM = 210;
const MIN_HEIGHT_MM = 120;
const PX_TO_MM = 25.4 / 96;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const puppeteer = (await import("puppeteer-core")).default;
    browserPromise = puppeteer
      .launch({
        executablePath: getChromiumExecutablePath(),
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      })
      .catch((err: unknown) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    await page.emulateMediaType("print");
    const dimensions = await page.evaluate(() => {
      const receipt = document.querySelector(".receipt") as HTMLElement | null;
      const target = receipt || document.body;
      const rect = target.getBoundingClientRect();
      return {
        height: Math.max(rect.height, document.documentElement.scrollHeight, document.body.scrollHeight),
      };
    });
    const pageHeightMm = Math.max(MIN_HEIGHT_MM, dimensions.height * PX_TO_MM + 4);
    const pdfUint8 = await page.pdf({
      width: `${A4_WIDTH_MM}mm`,
      height: `${pageHeightMm}mm`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await page.close();
  }
}
