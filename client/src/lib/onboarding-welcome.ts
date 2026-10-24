/** A registration-only signal, consumed before showing the welcome.
 * Never infer a new subscriber from missing browser progress or subscription tier.
 */
type WelcomeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const welcomeKey = (id: string) => `xpresspro-registration-welcome-v1:${id}`;
export function recordWelcomeEligibility(storage: WelcomeStorage, id: string, registration: boolean) {
  try {
    if (registration) storage.setItem(welcomeKey(id), "pending");
    else storage.removeItem(welcomeKey(id));
  } catch { /* Storage restrictions must not interrupt authentication. */ }
}
export function consumeRegistrationWelcome(storage: WelcomeStorage, id: string): boolean {
  try {
    if (storage.getItem(welcomeKey(id)) !== "pending") return false;
    storage.removeItem(welcomeKey(id));
    return true;
  } catch { return false; }
}
