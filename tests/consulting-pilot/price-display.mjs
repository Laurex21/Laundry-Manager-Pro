import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const site = new URL(process.env.PILOT_ORIGIN);
assert.ok(site.protocol === 'https:' && site.hostname.endsWith('.replit.dev'));
const sandbox = 'https://checkout.sandbox.pawapay.io';
const accounts = JSON.parse(await readFile(process.env.PILOT_FIXTURE, 'utf8'));
const learner = accounts.find(a => a.role === 'non-payant' && a.created && a.email.endsWith('@example.invalid'));
assert.ok(learner, 'An existing unpaid test account is required');
const evidence = process.env.PILOT_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const total = /\b100[\s.,]?000\s*(?:FCFA|F\s*CFA|XAF)\b/i;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const mobile of [false, true]) {
    const device = mobile ? 'mobile' : 'pc';
    const context = await browser.newContext({
      baseURL: site.origin, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile,
      viewport: mobile ? {width:390,height:844} : {width:1440,height:900},
      serviceWorkers:'block',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    async function capture(step) {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), step);
      if (evidence) await page.screenshot({animations: 'disabled', path: join(evidence, device + '-' + step + '.png')});
      console.log('PASS', device, step, '100 000 FCFA');
    }
    await page.goto('/auth', {waitUntil:'commit'});
    await page.getByTestId('input-email').fill(learner.email);
    await page.getByTestId('input-password').fill(learner.password);
    await page.getByTestId('button-auth-submit').click();
    await page.waitForURL(url => url.origin === site.origin && url.pathname !== '/auth');
    if (mobile) await page.getByTestId('bottom-nav-more').click();
    await page.getByRole('link',{name:'Formation',exact:true}).filter({visible:true}).click();
    await page.getByRole('link',{name:'Voir la formation',exact:true}).click();
    const card = page.locator('main section');
    await card.getByText('7 thèmes · 57 leçons').waitFor();
    await card.getByText(total).waitFor();
    await capture('fiche');
    await card.getByRole('button',{name:/Acheter la formation|Reprendre le paiement de test/}).click();
    const summary = page.getByRole('dialog',{name:'Récapitulatif de votre achat'});
    await summary.getByText('7 thèmes · 57 leçons').waitFor();
    await summary.getByText('Total à payer').waitFor();
    await summary.getByText(total).waitFor();
    await capture('recapitulatif');
    const response = page.waitForResponse(r => r.url() === site.origin + '/api/consulting-pilot/checkout' && r.request().method() === 'POST');
    await summary.getByRole('button',{name:'Continuer vers Mobile Money'}).click();
    const checkout = await response;
    assert.equal(checkout.status(),200);
    await page.waitForURL(url => url.origin === sandbox, {waitUntil:'domcontentloaded'});
    await page.getByText(total).filter({visible:true}).first().waitFor();
    await capture('pawapay-sandbox');
    // Opening the hosted form is the last step. No phone number or payment is submitted.
    await context.close();
  }
} finally {
  await browser.close();
}
