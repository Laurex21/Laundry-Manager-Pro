import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.STOREFRONT_TEST_ORIGIN || "http://127.0.0.1:5133";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error("Local fictional preview only");
const output = process.env.STOREFRONT_SCREENSHOTS || "/private/tmp/storefront-v2";
await mkdir(output, { recursive: true });
const fixtureImage = `${output}/image-test.png`;
await writeFile(fixtureImage, await sharp({ create: { width: 1000, height: 400, channels: 3, background: { r: 54, g: 70, b: 105 } } }).png().toBuffer());
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const staff = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  staff.on("pageerror", e => errors.push(e.message));
  await staff.goto(`${origin}/boutique`);
  await staff.getByRole("button", { name: "Configurer ma boutique" }).click();
  await staff.getByLabel("Logo", { exact: true }).setInputFiles(fixtureImage);
  await staff.getByRole("button", { name: "Retirer logo", exact: true }).waitFor();
  await staff.getByLabel("Photo de couverture", { exact: true }).setInputFiles(fixtureImage);
  await staff.getByRole("button", { name: "Retirer photo de couverture", exact: true }).waitFor();
  await staff.getByLabel("Message d’accueil").fill("Votre pressing, votre style.");
  await staff.getByRole("button", { name: "Continuer", exact: true }).click();
  await staff.getByText("Photo et options de Lavage & pliage", { exact: true }).click();
  await staff.getByLabel("Photo de Lavage & pliage", { exact: true }).setInputFiles(fixtureImage);
  await staff.getByRole("button", { name: "Retirer photo de lavage & pliage", exact: true }).waitFor();
  await staff.getByRole("button", { name: "Continuer", exact: true }).click();
  await staff.getByRole("button", { name: "Enregistrer et ouvrir la boutique" }).click();
  await staff.getByText("Configuration enregistrée.", { exact: true }).waitFor();
  await staff.reload();
  await staff.getByRole("button", { name: "Configurer ma boutique" }).click();
  assert.equal(await staff.getByLabel("Message d’accueil").inputValue(), "Votre pressing, votre style.");
  assert.equal(await staff.getByRole("button", { name: "Retirer logo", exact: true }).count(), 1);
  await staff.screenshot({ path: `${output}/08-personnalisation-desktop.png`, fullPage: true });
  await staff.getByRole("button", { name: /Ouvrir et partager/ }).click();
  await staff.getByRole("button", { name: "Copier le lien à partager" }).waitFor();
  await staff.getByRole("link", { name: "Connecter mon WhatsApp" }).click();
  await staff.getByText("La connexion Meta n’est pas encore disponible ici.", { exact: true }).waitFor();
  await staff.route("https://connect.facebook.net/fr_FR/sdk.js", async route => {
    await route.fulfill({ contentType: "application/javascript", body: `
      window.FB = {
        init: () => {},
        login: callback => {
          const dispatch = (origin, phone_number_id) => window.dispatchEvent(new MessageEvent("message", {
            origin,
            data: JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "102", phone_number_id } })
          }));
          dispatch("https://notfacebook.com", "999");
          callback({ authResponse: { code: "fixture-code" } });
          dispatch("https://www.facebook.com", "103");
        }
      };
    ` });
  });
  const signup = `${origin}/api/storefront/admin/flow-signup`;
  await staff.route(signup, route => route.fulfill({ json: { state: "ready", phone: "+237600000000" } }));
  await staff.route(`${signup}/start`, route => route.fulfill({ json: {
    appId: "100", configurationId: "101", version: "v27.0", phone: "+237600000000", attempt: "fixture-attempt",
  } }));
  let sentSignup;
  await staff.route(`${signup}/finish`, route => {
    sentSignup = route.request().postDataJSON();
    return route.fulfill({ json: { status: "pending", phone: "+237600000000" } });
  });
  await staff.reload();
  await staff.getByRole("button", { name: "Préparer la connexion" }).click();
  await staff.getByRole("button", { name: "Ouvrir la connexion Meta" }).click();
  await staff.getByText("Numéro +237600000000 vérifié. L’activation du formulaire est en attente.", { exact: true }).waitFor();
  assert.deepEqual(sentSignup, { authorization: "fixture-code", wabaId: "102", phoneNumberId: "103", attempt: "fixture-attempt" });
  await staff.getByRole("link", { name: "Retour à ma boutique" }).click();
  await staff.getByRole("button", { name: "Configurer ma boutique" }).click();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  mobile.on("pageerror", e => errors.push(e.message));
  await mobile.goto(`${origin}/b/pressing-horizon`);
  await mobile.getByText("Votre pressing, votre style.", { exact: true }).waitFor();
  assert.equal(await mobile.locator(".sf-logo").getAttribute("src").then(v => v.startsWith("data:image/webp;base64,")), true);
  assert.equal(await mobile.locator(".sf-cover").getAttribute("src").then(v => v.startsWith("data:image/webp;base64,")), true);
  let firstStarted;
  const first = new Promise(resolve => { firstStarted = resolve; });
  await mobile.route(`${origin}/api/public/shops/pressing-horizon/quote`, async route => {
    const request = route.request().postDataJSON();
    const response = await route.fetch();
    if (request.lines[0]?.count === 1) { firstStarted(); await new Promise(resolve => setTimeout(resolve, 1300)); }
    await route.fulfill({ response });
  });
  await mobile.getByRole("button", { name: "Ajouter T-shirt", exact: true }).click();
  await first;
  await mobile.getByRole("button", { name: "Ajouter T-shirt", exact: true }).click();
  await mobile.waitForFunction(() => /360/.test(document.querySelector(".sf-total")?.textContent || ""));
  await mobile.waitForTimeout(1500);
  assert.match(await mobile.locator(".sf-total").innerText(), /360/);
  await mobile.getByRole("button", { name: "Continuer", exact: true }).click();
  await mobile.getByRole("checkbox").check();
  await mobile.getByRole("button", { name: "Modifier mes vêtements" }).click();
  await mobile.getByRole("button", { name: "Ajouter T-shirt", exact: true }).click();
  await mobile.waitForFunction(() => /540/.test(document.querySelector(".sf-total")?.textContent || ""));
  await mobile.getByRole("button", { name: "Continuer", exact: true }).click();
  assert.equal(await mobile.getByRole("checkbox").isChecked(), false, "changed basket revokes old consent");
  await mobile.getByRole("button", { name: "Modifier mes vêtements" }).click();
  await mobile.getByRole("button", { name: /^Repassage/ }).click();
  assert.equal(await mobile.getByLabel("Vêtements pour", { exact: true }).count(), 0, "no weight group for piece billing");
  await mobile.getByRole("button", { name: "Ajouter Chemise", exact: true }).click();
  await mobile.waitForFunction(() => /1\s?040/.test(document.querySelector(".sf-total")?.textContent || ""));
  await mobile.screenshot({ path: `${output}/09-personnalisation-panier-mobile.png`, fullPage: true });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.setViewportSize({ width: 320, height: 740 });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no overflow at 320px");
  await staff.setViewportSize({ width: 390, height: 844 });
  await staff.screenshot({ path: `${output}/10-configuration-mobile.png`, fullPage: true });
  assert.equal(await staff.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "admin fits phone");
  assert.deepEqual(errors, []);
  console.log("PASS browser V2: logo/cover/service upload, reload persistence, public branding, delayed quote race, consent reset, piece billing, optional WhatsApp signup and original public link, 320/390px customer and 390px admin.");
} finally { await browser.close(); }
