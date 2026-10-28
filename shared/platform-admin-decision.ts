/** Read-only platform dashboard contract. Counts use organisations, never individual customers. */
export type DecisionAccount = { id:number; name:string; createdAt?:string; endDate?:string|null; lastOrderAt?:string|null };
export type DecisionOverview = {
  generatedAt:string; days:number; start:string; previousStart:string;
  growth:{ registered:number; newAccounts:number; previousNewAccounts:number; activeAccounts:number; firstOrders:number; cohortSize:number; cohortFirstOrders:number; cohortPayers:number };
  trials:{ active:number; due7:number; due14:number; paidPlansDue7:number; free:number; historical:number; excluded:number; due:DecisionAccount[] };
  revenue:{ commercial:number; previousCommercial:number; pilots:number; renewals:number; payingAccounts:number; cumulativePayers:number; offeredOrHistorical:number; daily:{date:string;amount:number}[] };
  payments:{ failed:number; pending:number; review:number; paidWithoutActivation:number; issues:{id:string;organisationId:number;name:string;status:string;providerStatus:string|null;createdAt:string;amount:number;paymentSource:string|null}[] };
  support:{ neverOrdered:number; inactive:number; never:DecisionAccount[]; returning:DecisionAccount[] };
  technical:{ maintenanceSuspended:boolean; excludedIds:number[]; billingMode:string; liveEnabled:boolean; databaseEnvironment:string; buildCommit:string|null; builtAt:string|null; backupVerifiedAt:null };
};
