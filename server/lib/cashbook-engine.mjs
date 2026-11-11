// Development-only pure calculations. No database, network or environment access.
const SCALE = 1000000n;
export function money(value) {
  if (typeof value !== 'string' || !/^-?\d+(\.\d{1,6})?$/.test(value)) throw Error('INVALID_AMOUNT');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  return (BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'))) * (negative ? -1n : 1n);
}
export function decimal(value) {
  const sign = value < 0n ? '-' : ''; const n = value < 0n ? -value : value;
  const tail = String(n % SCALE).padStart(6, '0').replace(/0+$/, '');
  return sign + String(n / SCALE) + (tail ? '.' + tail : '');
}
function instant(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('EXPLICIT_TIMEZONE_REQUIRED');
  return Date.parse(value);
}
function monthAt(at, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(at));
  return parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value;
}
export function paymentAccount(method) {
  const methods = { Cash: 'cash', 'Bank Transfer': 'bank', Wave: 'wave', 'Orange Money': 'orange', 'MTN Mobile Money': 'mtn' };
  if (method === 'Client Credit') return null; // Settlement of a liability, not new money.
  return methods[method] ?? 'unallocated';
}
export function report({ organisationId, authorisedSiteIds, siteIds, currency, month, timeZone, accounts, movements }) {
  if (!Number.isSafeInteger(organisationId) || organisationId < 1 || !/^[A-Z]{3}$/.test(currency) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('INVALID_SCOPE');
  if (!siteIds.length || siteIds.some(id => !authorisedSiteIds.includes(id))) throw Error('FORBIDDEN_SITE');
  monthAt(Date.now(), timeZone); // Validate IANA zone, never use the host timezone.
  const scoped = accounts.filter(a => a.organisationId === organisationId && siteIds.includes(a.siteId) && a.currency === currency);
  const keys = new Set(); const totals = { opening: 0n, receipts: 0n, expenses: 0n, withdrawals: 0n, refunds: 0n, transfersIn: 0n, transfersOut: 0n, correctionsIn: 0n, correctionsOut: 0n, closing: 0n };
  const rows = scoped.map(account => {
    const key = `${account.siteId}:${account.id}`;
    if (keys.has(key)) throw Error('DUPLICATE_ACCOUNT'); keys.add(key);
    const start = instant(account.openedAt);
    const sums = { opening: money(account.openingBalance), receipts: 0n, expenses: 0n, withdrawals: 0n, refunds: 0n, transfersIn: 0n, transfersOut: 0n, correctionsIn: 0n, correctionsOut: 0n, closing: 0n };
    if (monthAt(start, timeZone) > month) throw Error('ACCOUNT_NOT_OPEN');
    const seen = new Map();
    for (const m of movements) {
      if (m.organisationId !== organisationId || m.siteId !== account.siteId || m.accountId !== account.id || m.currency !== currency) continue;
      if (!m.sourceKey) throw Error('SOURCE_KEY_REQUIRED');
      const encoded = JSON.stringify(m);
      if (seen.has(m.sourceKey)) { if (seen.get(m.sourceKey) !== encoded) throw Error('CONFLICTING_DUPLICATE'); continue; }
      seen.set(m.sourceKey, encoded);
      const at = instant(m.at); if (at < start || monthAt(at, timeZone) > month) continue;
      if (!['receipt', 'expense', 'withdrawal', 'refund', 'transfer_in', 'transfer_out', 'correction_in', 'correction_out'].includes(m.kind)) throw Error('INVALID_MOVEMENT');
      const amount = money(m.amount); if (amount <= 0n) throw Error('POSITIVE_AMOUNT_REQUIRED');
      const incoming = ['receipt', 'transfer_in', 'correction_in'].includes(m.kind);
      if (monthAt(at, timeZone) < month) sums.opening += incoming ? amount : -amount;
      else sums[({receipt:'receipts',expense:'expenses',withdrawal:'withdrawals',refund:'refunds',transfer_in:'transfersIn',transfer_out:'transfersOut',correction_in:'correctionsIn',correction_out:'correctionsOut'})[m.kind]] += amount;
    }
    sums.closing = sums.opening + sums.correctionsIn - sums.correctionsOut + sums.receipts + sums.transfersIn - sums.expenses - sums.withdrawals - sums.refunds - sums.transfersOut;
    for (const key of Object.keys(totals)) totals[key] += sums[key];
    return { ...account, ...Object.fromEntries(Object.entries(sums).map(([k,v]) => [k, decimal(v)])) };
  });
  const unmatched = movements.filter(m => m.organisationId === organisationId && siteIds.includes(m.siteId) && m.currency === currency && monthAt(instant(m.at), timeZone) <= month && !keys.has(`${m.siteId}:${m.accountId}`));
  const openingValidated = scoped.length > 0 && scoped.every(a => a.openingValidated === true);
  return { month, timeZone, currency, rows, totals: Object.fromEntries(Object.entries(totals).map(([k,v]) => [k, decimal(v)])), openingValidated, unallocatedCount: unmatched.length, canClose: openingValidated && unmatched.length === 0 && rows.length > 0 };
}
export function prepareClose(result, counted, actor, reason) {
  if (!result.canClose) throw Error('RECONCILIATION_REQUIRED');
  if (!actor || !reason?.trim()) throw Error('AUDIT_REQUIRED');
  const rows = result.rows.map(row => {
    const key = `${row.siteId}:${row.id}`;
    if (!(key in counted)) throw Error('COUNT_REQUIRED');
    return { siteId: row.siteId, accountId: row.id, expected: row.closing, counted: decimal(money(counted[key])), variance: decimal(money(counted[key]) - money(row.closing)) };
  });
  return { status: 'preview_only', month: result.month, currency: result.currency, actor, reason, rows, snapshot: JSON.stringify(result) };
}
