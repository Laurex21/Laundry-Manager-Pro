export const LOYALTY_TIERS = {
  bronze: { minPoints: 0, label: "Bronze", color: "#CD7F32", multiplier: 1 },
  silver: { minPoints: 500, label: "Silver", color: "#C0C0C0", multiplier: 1.1 },
  gold: { minPoints: 1500, label: "Gold", color: "#FFD700", multiplier: 1.2 },
  platinum: { minPoints: 3000, label: "Platinum", color: "#E5E4E2", multiplier: 1.3 },
  diamond: { minPoints: 5000, label: "Diamond", color: "#B9F2FF", multiplier: 1.5 },
} as const;

export type LoyaltyTier = keyof typeof LOYALTY_TIERS;

export function computeTier(totalLifetimePoints: number): LoyaltyTier {
  if (totalLifetimePoints >= 5000) return "diamond";
  if (totalLifetimePoints >= 3000) return "platinum";
  if (totalLifetimePoints >= 1500) return "gold";
  if (totalLifetimePoints >= 500) return "silver";
  return "bronze";
}

export function computeOrderPoints(
  amount: number,
  pointsPerOrder: number,
  pointsPerFcfa: number | null,
  tier: LoyaltyTier,
) {
  const spendPoints = pointsPerFcfa == null ? 0 : Math.floor(amount * pointsPerFcfa);
  return Math.max(0, Math.round((pointsPerOrder + spendPoints) * LOYALTY_TIERS[tier].multiplier));
}
