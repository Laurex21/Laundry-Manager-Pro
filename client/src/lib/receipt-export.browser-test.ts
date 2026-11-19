import { renderReceiptCanvas, downloadReceiptDocument } from './receipt-export';
import { generateDepositReceipt } from './receipt';
import { DEFAULT_SETTINGS } from './receipt-settings';

// Run in a real browser: canvas pixels catch clipping that HTML assertions miss.
const logo = document.createElement('canvas');
logo.width = 100;
logo.height = 50;
const paint = logo.getContext('2d')!;
paint.fillStyle = '#00ff00';
paint.fillRect(0, 0, 100, 25);
paint.fillStyle = '#ff00ff';
paint.fillRect(0, 25, 100, 25);
let html = '';
(globalThis as any).__captureReceiptHtml = (value: string) => { html = value; };
try {
  await generateDepositReceipt({
    id: 1, orderReference: 'QA-HEADER', createdAt: '2026-11-19T09:00:00Z',
    customer: { name: 'Client fictif' }, status: 'received', payments: [],
    items: [{ quantity: 2, priceAtOrder: '1500', service: { name: 'Chemise', unit: 'piece' } }],
  }, 'FCFA ', { ...DEFAULT_SETTINGS, businessName: 'PRESSING TEST — EN-TÊTE COMPLET',
    receiptLanguage: 'fr', receiptHeaderColor: '#2563eb', logoBase64: logo.toDataURL(),
  }, 'html');
} finally { delete (globalThis as any).__captureReceiptHtml; }

document.body.innerHTML = '<h1>Vérification du cadrage des reçus</h1><p>Données fictives uniquement.</p><button id="run">Vérifier le rendu</button><button id="pdf">PDF</button><button id="png">PNG</button><pre id="result">Prêt</pre><div id="preview"></div>';
const result = document.querySelector('#result')!;
const preview = document.querySelector('#preview')!;
const check = (ok: boolean, label: string) => { if (!ok) throw new Error(label); };
document.querySelector<HTMLButtonElement>('#run')!.onclick = async () => {
  result.textContent = 'Vérification…';
  preview.replaceChildren();
  const checks: unknown[] = [];
  try {
    // The print button gets stripped by sanitization, leaving its text behind.
    // Archived documents can also have text/controls before their receipt root.
    for (const [name, input] of [
      ['generated', html],
      ['archived-with-toolbar', html.replace('<body>', '<body><div style="height:90px">Ancienne barre d’outils</div>')],
    ]) {
      const canvas = await renderReceiptCanvas(input);
      const scale = canvas.width / 680;
      const ctx = canvas.getContext('2d')!;
      const sample = (x: number, y: number) => Array.from(ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data).slice(0, 3).join(',');
      canvas.style.cssText = 'width:680px;max-width:100%;height:auto;display:block;margin-bottom:24px';
      preview.append(canvas);
      check(sample(45, 35) === '0,255,0', `${name}: haut du logo coupé`);
      check(sample(45, 65) === '255,0,255', `${name}: bas du logo coupé`);
      check(sample(200, 12) === '37,99,235', `${name}: marge supérieure coupée`);
      checks.push({ name, width: canvas.width, height: canvas.height, scale, result: 'PASS' });
    }
    result.textContent = JSON.stringify({ status: 'PASS', checks }, null, 2);
  } catch (error) { result.textContent = JSON.stringify({ status: 'FAIL', checks, error: String(error) }, null, 2); }
};
for (const format of ['pdf', 'png'] as const) {
  document.querySelector<HTMLButtonElement>('#' + format)!.onclick = async () => {
    result.textContent = 'Téléchargement…';
    try { await downloadReceiptDocument(html, 'receipt-header-regression', format); result.textContent = 'PASS — téléchargement ' + format; }
    catch (error) { result.textContent = 'FAIL — ' + String(error); }
  };
}
