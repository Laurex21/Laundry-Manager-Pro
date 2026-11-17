/** Read-only platform dashboard contract. Counts use organisations, never individual customers. */
export type DecisionAccount = { id:number; name:string; createdAt?:string; endDate?:string|null; lastOrderAt?:string|null };
export type RevenueScope = 'commercial' | 'previous' | 'pilots' | 'renewals';
export type DecisionReceipt = {
  id:string; organisationId:number; name:string; amount:number; paidAt:string;
  planName:string|null; kind:'cycle'|'renewal'|'upgrade'|'options'|'unknown';
  pilot:boolean; period:'current'|'previous';
};
export type FollowUpStatus = 'new'|'support'|'payment_review'|'subscription'|'renewal'|'active'|'watch';
export type FollowUpReason = 'recent_signup'|'no_orders'|'stopped_ordering'|'payment_issue'|'trial_ending'|'free_regular'|'renewal_due'|'paid_access'|'prepaid_trial'|'getting_started';
export type DecisionRegistration = {
  id:number; name:string; createdAt:string; ageDays:number;
  owner:{name:string; email:string|null; phone:string|null};
  activity:{orders:number; orders7:number; activeDays7:number; firstOrderAt:string|null; lastOrderAt:string|null; daysSinceLastOrder:number|null};
  subscription:{planName:string|null; status:string|null; endDate:string|null; source:string; paidAccess:boolean; hasCommercialPayment:boolean; lastPaymentAt:string|null};
  followUp:{status:FollowUpStatus; reason:FollowUpReason};
};
export type DecisionOverview = {
  generatedAt:string; days:number; start:string; previousStart:string;
  growth:{ registered:number; newAccounts:number; previousNewAccounts:number; activeAccounts:number; firstOrders:number; cohortSize:number; cohortFirstOrders:number; cohortPayers:number };
  trials:{ active:number; due7:number; due14:number; paidPlansDue7:number; free:number; historical:number; excluded:number; due:DecisionAccount[] };
  revenue:{ commercial:number; previousCommercial:number; pilots:number; renewals:number; payingAccounts:number; cumulativePayers:number; offeredOrHistorical:number; daily:{date:string;amount:number}[]; receipts:DecisionReceipt[] };
  registrations:DecisionRegistration[];
  payments:{ failed:number; pending:number; review:number; paidWithoutActivation:number; issues:{id:string;organisationId:number;name:string;status:string;providerStatus:string|null;createdAt:string;amount:number;paymentSource:string|null}[] };
  support:{ neverOrdered:number; inactive:number; never:DecisionAccount[]; returning:DecisionAccount[] };
  technical:{ maintenanceSuspended:boolean; excludedIds:number[]; billingMode:string; liveEnabled:boolean; databaseEnvironment:string; buildCommit:string|null; builtAt:string|null; backupVerifiedAt:null };
};
