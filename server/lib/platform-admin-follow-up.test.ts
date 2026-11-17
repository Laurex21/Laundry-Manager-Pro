import assert from 'node:assert/strict';
import { registrationFollowUp } from './platform-admin-follow-up';
import type { DecisionRegistration } from '../../shared/platform-admin-decision';

const now = new Date('2026-11-17T12:00:00Z');
const row: Omit<DecisionRegistration, 'followUp'> = {
  id: 1, name: 'Pressing fictif', createdAt: '2026-11-15T12:00:00Z', ageDays: 2,
  owner: { name: '', email: null, phone: null },
  activity: { orders: 0, orders7: 0, activeDays7: 0, firstOrderAt: null, lastOrderAt: null, daysSinceLastOrder: null },
  subscription: { planName: 'Business', status: 'trial', endDate: '2026-11-20T12:00:00Z', source: 'saas', paidAccess: false, hasCommercialPayment: false, lastPaymentAt: null },
};
const follow = (r = row, issue = false) => registrationFollowUp(r, issue, now);
assert.equal(follow().reason, 'no_orders', 'Help starts exactly at 48 hours');
assert.equal(follow({ ...row, createdAt: '2026-11-15T12:00:01Z' }).status, 'new');
assert.equal(follow(row, true).status, 'payment_review', 'Payment issue takes priority over sales or support');
const active = { ...row, activity: { ...row.activity, orders: 3, orders7: 3, activeDays7: 2, daysSinceLastOrder: 0 } };
assert.equal(follow(active).reason, 'trial_ending');
assert.equal(follow({ ...active, activity: { ...active.activity, activeDays7: 1 } }).status, 'watch', 'Three orders on one day are not regular usage');
assert.equal(follow({ ...active, activity: { ...active.activity, orders7: 2 } }).status, 'watch');
assert.equal(follow({ ...active, activity: { ...active.activity, daysSinceLastOrder: 7 } }).reason, 'stopped_ordering');
assert.equal(follow({ ...active, subscription: { ...active.subscription, endDate: '2026-11-24T12:00:01Z' } }).status, 'watch');
assert.equal(follow({ ...active, subscription: { ...active.subscription, status: 'active', planName: 'Starter' } }).reason, 'free_regular');
assert.equal(follow({ ...active, subscription: { ...active.subscription, status: 'active', planName: 'Legacy Starter', paidAccess: true } }).reason, 'paid_access', 'Gifted/historical access is preserved regardless of plan name');
assert.equal(follow({ ...active, subscription: { ...active.subscription, hasCommercialPayment: true } }).reason, 'prepaid_trial');
assert.equal(follow({ ...active, subscription: { ...active.subscription, status: 'active', paidAccess: true, hasCommercialPayment: true } }).reason, 'renewal_due');
assert.equal(follow(active, true).status, 'payment_review');
console.log('PASS follow-up rules: 48-hour boundary, regular use, inactivity, trial end, free plan, gifted/historical access, prepaid trial, payment priority');
