import type { DecisionRegistration } from '../../shared/platform-admin-decision';

const DAY = 86400000;
/** Read-only suggestions. Payment/access facts take precedence over a sales suggestion. */
export function registrationFollowUp(
  account: Omit<DecisionRegistration, 'followUp'>,
  paymentIssue: boolean,
  now: Date,
): DecisionRegistration['followUp'] {
  const { activity, subscription } = account;
  const end = subscription.endDate ? Date.parse(subscription.endDate) : null;
  const due = end !== null && end > now.getTime() && end <= now.getTime() + 7 * DAY;
  if (paymentIssue) return { status: 'payment_review', reason: 'payment_issue' };
  if (!activity.orders) return now.getTime() - Date.parse(account.createdAt) >= 2 * DAY
    ? { status: 'support', reason: 'no_orders' }
    : { status: 'new', reason: 'recent_signup' };
  if (activity.daysSinceLastOrder !== null && activity.daysSinceLastOrder >= 7)
    return { status: 'support', reason: 'stopped_ordering' };
  // Complimentary/historical access is still acquired access; never ask for a new subscription during it.
  if (subscription.paidAccess)
    return due && subscription.hasCommercialPayment
      ? { status: 'renewal', reason: 'renewal_due' }
      : { status: 'active', reason: 'paid_access' };
  if (subscription.status === 'trial' && subscription.hasCommercialPayment)
    return { status: 'active', reason: 'prepaid_trial' };
  const regular = activity.orders7 >= 3 && activity.activeDays7 >= 2;
  if (regular && subscription.status === 'trial' && due)
    return { status: 'subscription', reason: 'trial_ending' };
  if (regular && subscription.status === 'active' && !subscription.paidAccess)
    return { status: 'subscription', reason: 'free_regular' };
  return { status: 'watch', reason: 'getting_started' };
}
