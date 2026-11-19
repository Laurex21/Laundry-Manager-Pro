export const RECEIPT_TIMEOUT = "RECEIPT_TIMEOUT";
export const RECEIPT_REQUEST_TIMEOUT_MS = 20_000;

/** Bound both the response headers and body, including on a stalled connection. */
export async function withReceiptTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = RECEIPT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(RECEIPT_TIMEOUT)), timeoutMs);
  try {
    return await waitForReceiptOperation(operation(controller.signal), controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function waitForReceiptOperation<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason || new Error(RECEIPT_TIMEOUT));
    if (signal.aborted) aborted();
    else signal.addEventListener("abort", aborted, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
  });
}

export function requestReceipt<T>(
  url: string,
  read: (response: Response) => Promise<T>,
  init: RequestInit = {},
): Promise<T> {
  return withReceiptTimeout(async signal => {
    const response = await fetch(url, { ...init, credentials: "include", signal });
    if (signal.aborted) throw signal.reason;
    return read(response);
  });
}
