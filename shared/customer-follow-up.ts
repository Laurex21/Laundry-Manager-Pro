import {z} from 'zod';
export const followUpChannels=['whatsapp','sms','call'] as const;
export const followUpOutcomes=['no_answer','contacted','return_planned','unavailable','declined'] as const;
export const followUpStatuses=['to_contact','contacted','return_planned','returned','unavailable','declined'] as const;
export type FollowUpStatus=typeof followUpStatuses[number];
export const followUpInput=z.object({id:z.uuid(),channel:z.enum(followUpChannels),outcome:z.enum(followUpOutcomes),note:z.string().trim().min(3).max(2000),nextReminderDate:z.iso.date().nullable()}).strict();
export type FollowUpInput=z.infer<typeof followUpInput>;
export type FollowUpEvent={id:string;customerId:number;actorName:string;channel:typeof followUpChannels[number];outcome:typeof followUpOutcomes[number];note:string;nextReminderDate:string|null;createdAt:string};
export type FollowUpCustomer={id:number;siteId:number;name:string;phone:string;email:string|null;lastVisitAt:string|null;avgDaysBetweenVisits:number|null;visitCount:number;daysSinceLastVisit:number|null;atRisk:boolean;status:FollowUpStatus;contactCount:number;lastContactAt:string|null;nextReminderDate:string|null;returnedAt:string|null;averageOrderAmount:number|null;monthlyRevenueAtRisk:number|null};
export type FollowUpDetail={customer:FollowUpCustomer;events:FollowUpEvent[]};
export function followUpStatus(last:Pick<FollowUpEvent,'outcome'>|null,returned:boolean):FollowUpStatus{
 if(returned)return 'returned';
 if(!last||last.outcome==='no_answer')return 'to_contact';
 return last.outcome;
}
