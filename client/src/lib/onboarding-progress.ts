export const ONBOARDING_ACTIONS = ["identity", "service", "customer", "order", "status", "payment", "receipt"] as const;
export type OnboardingAction = typeof ONBOARDING_ACTIONS[number];
export const ONBOARDING_EVENT = "xpresspro:onboarding-completed";
export const progressKey = (userId: string) => `xpresspro-getting-started-v1:${userId}`;
export const completionKey = (userId: string) => `xpresspro-getting-started-actions-v1:${userId}`;

export function parseCompleted(value: string | null): OnboardingAction[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? ONBOARDING_ACTIONS.filter(action => parsed.includes(action)) : [];
  } catch { return []; }
}
