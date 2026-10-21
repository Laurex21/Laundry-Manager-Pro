import { queryClient } from "./queryClient";
import { completionKey, ONBOARDING_EVENT, parseCompleted, type OnboardingAction } from "./onboarding-progress";

// Called only after the server accepts an action or a receipt download starts.
// Progress is informational and never controls access to business features.
export function recordOnboardingAction(action: OnboardingAction) {
  const user = queryClient.getQueryData<{ id: string; role: string }>(["/api/auth/user"]);
  if (!user?.id || user.role !== "owner" || typeof window === "undefined") return;
  try {
    const key = completionKey(user.id);
    const completed = parseCompleted(window.localStorage.getItem(key));
    if (!completed.includes(action)) completed.push(action);
    window.localStorage.setItem(key, JSON.stringify(completed));
    window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT, { detail: { userId: user.id } }));
  } catch { /* Unavailable browser storage must not interrupt a successful save. */ }
}
