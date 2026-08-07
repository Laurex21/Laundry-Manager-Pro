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

function requiredSeedIds() {
  expect(state.customerId).toBeTruthy();
  expect(state.pieceServiceId).toBeTruthy();
  expect(state.kgServiceId).toBeTruthy();
  expect(state.customerSubscriptionId).toBeTruthy();
  return {
    customerId: state.customerId!,
    pieceServiceId: state.pieceServiceId!,
    kgServiceId: state.kgServiceId!,
    customerSubscriptionId: state.customerSubscriptionId!,
  };
}

async function activePricing(page: Page) {
  const response = await page.request.get("/api/stain-treatment/prices");
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function postCoveredOrder(page: Page, discount: { fixed?: string; percentage?: number }, suffix: string, advancePayment = "25.00") {
  const ids = requiredSeedIds();
  const pricing = await activePricing(page);
  const response = await page.request.post("/api/orders", { data: {
    customerId: ids.customerId,
    idempotencyKey: `stain-e2e-order-${suffix}`,
    expectedPricingSetVersion: pricing.expectedPricingSetVersion,
    discount: discount.fixed ?? "0",
    discountPct: discount.percentage ?? 0,
    pickupCost: "5.00",
    advancePayment,
    advancePaymentMethod: "Cash",
    items: [
      { serviceId: ids.pieceServiceId, quantity: 2 },
      { serviceId: ids.kgServiceId, quantity: 1 },
    ],
    garmentItems: [],
    machineUsages: [],
    treatments: [
      { orderItemIndex: 0, level: "standard", quantity: "1", idempotencyKey: `${suffix}-piece-standard` },
      { orderItemIndex: 0, level: "intensive", quantity: "1", idempotencyKey: `${suffix}-piece-intensive` },
      { orderItemIndex: 1, level: "standard", quantity: "0.5", idempotencyKey: `${suffix}-kg-standard` },
      { orderItemIndex: 1, level: "very_intensive", quantity: "0.5", idempotencyKey: `${suffix}-kg-very`, acknowledgement: { affirmed: true, textVersion: "stain-removal-not-guaranteed-v1" } },
    ],
  } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
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

test("piece/kg splits, all levels, fixed and percentage discounts, payments, membership and corrections post successfully", async ({ page }) => {
  await login(page, "owner");
  const ids = requiredSeedIds();
  const fixed = await postCoveredOrder(page, { fixed: "5.00" }, `fixed-${Date.now()}`);
  const fixedDetailResponse = await page.request.get(`/api/orders/${fixed.id}`);
  expect(fixedDetailResponse.ok(), await fixedDetailResponse.text()).toBeTruthy();
  const fixedDetail = await fixedDetailResponse.json();
  expect(fixedDetail.stainTreatments).toHaveLength(4);
  expect(new Set(fixedDetail.stainTreatments.map((line: any) => line.level))).toEqual(new Set(["standard", "intensive", "very_intensive"]));
  expect(new Set(fixedDetail.stainTreatments.map((line: any) => line.unit))).toEqual(new Set(["piece", "kg"]));
  const advanceResponse = await page.request.get(`/api/orders/${fixed.id}/payments`);
  expect(advanceResponse.ok(), await advanceResponse.text()).toBeTruthy();
  expect((await advanceResponse.json()).some((payment: any) => payment.isAdvance && String(payment.amount) === "25.00")).toBeTruthy();

  const membershipOrder = await postCoveredOrder(page, {}, `membership-${Date.now()}`, "0.00");
  const membership = await page.request.post("/api/subscriptions/apply-to-order", { data: { customerSubscriptionId: ids.customerSubscriptionId, orderId: membershipOrder.id } });
  expect(membership.ok(), await membership.text()).toBeTruthy();
  const membershipPayload = await membership.json();
  expect(String(membershipPayload.coverage.treatmentAmount)).not.toBe("0.00");
  expect(String(membershipPayload.coverage.finalAmount)).not.toBe("0.00");

  const percentage = await postCoveredOrder(page, { percentage: 10 }, `percentage-${Date.now()}`);
  expect(String(percentage.discount)).not.toBe("0.00");

  const correction = await page.request.post(`/api/orders/${state.orderId}/paid-correction`, { data: {
    customerId: ids.customerId,
    entryDate: new Date().toISOString(),
    pickupDate: null,
    reason: "E2E verified paid correction",
    idempotencyKey: `stain-e2e-correction-${Date.now()}`,
    items: [{ serviceId: ids.pieceServiceId, quantity: 2 }, { serviceId: ids.kgServiceId, quantity: 1 }],
    garments: [],
  } });
  expect(correction.status(), await correction.text()).toBe(201);
});

test("EN, FR and PT render stain treatment controls", async ({ page }) => {
  await login(page, "owner");
  await page.goto("/orders");
  for (const [language, expected] of [["en", /Add stain treatment/i], ["fr", /Ajouter un traitement/i], ["pt", /Adicionar tratamento/i]] as const) {
    await page.getByTestId("button-language-toggle").click();
    await page.getByTestId(`menu-item-lang-${language}`).click();
    await expect(page.getByText(expected).first()).toBeVisible();
  }
});

test("forced price-version conflict opens a focus-trapped review dialog", async ({ page }) => {
  await login(page, "owner");
  await page.goto("/orders");
  await page.getByRole("button", { name: /new order|nouvelle commande|novo pedido/i }).first().click();
  await page.getByRole("combobox", { name: /customers|clients|clientes/i }).click();
  await page.getByText("E2E Customer").click();
  await page.getByRole("combobox", { name: /service/i }).first().click();
  await page.getByText("E2E Shirt").click();
  await page.getByRole("button", { name: /add stain treatment|ajouter un traitement|adicionar tratamento/i }).click();
  const stalePricing = await activePricing(page);
  const changedPricing = await page.request.put("/api/stain-treatment/prices", { data: {
    rates: stalePricing.rates.map((rate: any) => ({
      level: rate.level,
      unit: rate.unit,
      price: (Number(rate.price) + 1).toFixed(2),
    })),
  } });
  expect(changedPricing.ok(), await changedPricing.text()).toBeTruthy();
  await page.getByRole("button", { name: /create new order|créer.*commande|criar novo pedido/i }).click();
  const dialog = page.getByRole("alertdialog", { name: /stain treatment prices changed|tarifs de traitement ont changé|preços.*mudaram/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toBeVisible();
});

test("receipt, detail, and report surfaces render", async ({ page }) => {
  await login(page, "owner");
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
