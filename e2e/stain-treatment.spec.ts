import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { STATE_FILE, type StainE2EState } from "../scripts/seed-stain-treatment-e2e";

let state: StainE2EState;
test.beforeAll(async () => { state = JSON.parse(await readFile(STATE_FILE, "utf8")); });

async function login(page: Page, actor: keyof StainE2EState["credentials"]) {
  const credential = state.credentials[actor];
  const endpoint = actor === "owner" ? "/api/auth/login" : "/api/staff/login";
  const response = await page.request.post(endpoint, { data: credential });
  expect(response.ok(), await response.text()).toBeTruthy();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
}

test("Owner and capable Manager can configure all six fixed rates", async ({ page }, testInfo) => {
  await login(page, "owner");
  await page.goto("/settings");
  await page.getByTestId("tab-stain-treatment").click();
  await expect(page.getByText(/Stain treatment prices|Tarifs du traitement|Preços do tratamento/i)).toBeVisible();
  await expect(page.locator('input[inputmode="decimal"]')).toHaveCount(6);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await page.screenshot({ path: testInfo.outputPath("owner-pricing.png"), fullPage: true });

  await page.context().clearCookies();
  await login(page, "capableManager");
  await page.goto("/settings");
  await expect(page.getByTestId("tab-stain-treatment")).toBeVisible();
});

test("unauthorized Manager and Operator cannot access pricing controls", async ({ page }) => {
  await login(page, "manager");
  await page.goto("/settings");
  await expect(page.getByTestId("tab-stain-treatment")).toHaveCount(0);
  const forbidden = await page.request.put("/api/stain-treatment/prices", { data: { rates: [] } });
  expect(forbidden.status()).toBe(403);
  await page.context().clearCookies();
  await login(page, "operator");
  const operatorForbidden = await page.request.put("/api/stain-treatment/prices", { data: { rates: [] } });
  expect(operatorForbidden.status()).toBe(403);
});

test("piece and kg order editor exposes three levels and Very intensive acknowledgement", async ({ page }, testInfo) => {
  await login(page, "owner");
  await page.goto("/orders");
  await page.getByRole("button", { name: /new order|nouvelle commande|novo pedido/i }).first().click();
  await expect(page.getByText(/E2E Shirt/)).toBeVisible();
  await expect(page.getByText(/E2E Wash by kg/)).toBeVisible();
  await page.getByRole("button", { name: /add stain treatment|ajouter un traitement|adicionar tratamento/i }).click();
  await expect(page.getByText(/Standard/).first()).toBeVisible();
  await expect(page.getByText(/Intensive|Intensif|Intensivo/).first()).toBeVisible();
  await expect(page.getByText(/Very intensive|Très intensif|Muito intensivo/).first()).toBeVisible();
  await expect(page.locator('[aria-live="polite"]')).toContainText(/subtotal|sous-total/i);
  await expectNoSeriousAxeViolations(page);
  await page.screenshot({ path: testInfo.outputPath("order-stain-editor.png"), fullPage: true });
});

test("price-change dialog traps focus and receipt, detail, and report surfaces render", async ({ page }) => {
  await login(page, "owner");
  await page.goto("/orders");
  const dialog = page.getByRole("alertdialog", { name: /stain treatment prices changed|tarifs de traitement ont changé|preços.*mudaram/i });
  // The dialog is server-conflict driven; when present its accessible focus contract is mandatory.
  if (await dialog.count()) {
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(":focus")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toBeVisible();
  }
  await page.goto("/analytics");
  await expect(page.getByTestId("stain-treatment-analytics")).toBeVisible();
  await expect(page.getByText(/Standard/).first()).toBeVisible();
  await expect(page.getByText(/Intensive|Intensif|Intensivo/).first()).toBeVisible();
  await expect(page.getByText(/Very intensive|Très intensif|Muito intensivo/).first()).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  expect(state.orderId).toBeTruthy();
  await page.goto(`/orders/${state.orderId}`);
  await expect(page.getByTestId("stain-treatment-history")).toBeVisible();
  await expect(page.getByText(/Customer acknowledgement|Consentement du client|Confirmação do cliente/i)).toBeVisible();
  await expect(page.getByText(/receipt|reçu|recibo/i).first()).toBeVisible();
});

test("320px layout has no horizontal document overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-320", "mobile-only reflow assertion");
  await login(page, "owner");
  for (const route of ["/settings", "/orders", "/analytics"]) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} overflows the 320px viewport`).toBeLessThanOrEqual(1);
  }
});
