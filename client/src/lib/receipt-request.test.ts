import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveReceiptHtml } from "./receipt-archive";
import { requestReceipt, withReceiptTimeout, RECEIPT_REQUEST_TIMEOUT_MS } from "./receipt-request";

test("a stalled receipt request is aborted and a retry can succeed", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, "fetch", (_url: string, init: RequestInit) => {
    signal = init.signal as AbortSignal;
    return new Promise<Response>(() => {});
  });
  const failed = assert.rejects(requestReceipt("/receipt", r => r.text()), /RECEIPT_TIMEOUT/);
  t.mock.timers.tick(RECEIPT_REQUEST_TIMEOUT_MS);
  await failed;
  assert.equal(signal?.aborted, true);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => new Response("receipt"));
  assert.equal(await requestReceipt("/receipt", r => r.text()), "receipt");
});

test("receiving headers does not leave an interrupted response body unbounded", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let reading = false;
  t.mock.method(globalThis, "fetch", async () => ({
    text: () => { reading = true; return new Promise<string>(() => {}); },
  }));
  const failed = assert.rejects(requestReceipt("/receipt", r => r.text()), /RECEIPT_TIMEOUT/);
  await Promise.resolve();
  assert.equal(reading, true);
  t.mock.timers.tick(RECEIPT_REQUEST_TIMEOUT_MS);
  await failed;
});

test("a stalled renderer also settles, without accepting its late result", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finish!: (value: string) => void;
  let signal: AbortSignal | undefined;
  let completed = false;
  const task = withReceiptTimeout(s => {
    signal = s;
    return new Promise<string>(resolve => { finish = resolve; });
  }, 30_000).then(() => { completed = true; });
  const failed = assert.rejects(task, /RECEIPT_TIMEOUT/);
  t.mock.timers.tick(30_000);
  await failed;
  assert.equal(signal?.aborted, true);
  finish("late image");
  await Promise.resolve();
  assert.equal(completed, false);
});

test("archiving returns the frozen receipt and never falls back on an archive error", async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as any).window;
  });
  const frozen = '<main class="receipt">2,125 kg — 3 625 FCFA</main>';
  const context = { orderId: 999, kind: "deposit" as const };
  let calls = 0;
  let archiveStatus = 200;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(init.credentials, "include");
    assert.ok(init.signal);
    if (url === "/api/saas/config") return Response.json({ enabled: true });
    assert.equal(url, "/api/receipt-snapshots");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(String(init.body)), { ...context, html: "new template" });
    return Response.json({ html: frozen }, { status: archiveStatus });
  });
  assert.equal(await archiveReceiptHtml("new template", context), frozen);
  assert.equal(calls, 2);
  archiveStatus = 503;
  await assert.rejects(archiveReceiptHtml("new template", context), /Receipt archive unavailable/);
  assert.equal(calls, 4);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 401 }));
  await assert.rejects(archiveReceiptHtml("new template", context), /Receipt archive unavailable/);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({ enabled: false }));
  assert.equal(await archiveReceiptHtml("new template", context), "new template");
});
