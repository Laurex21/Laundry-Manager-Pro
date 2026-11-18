import { z } from 'zod';
import type { DecisionRegistration, FollowUpReason } from './platform-admin-decision';

export const contactChannels = ['whatsapp', 'email', 'call', 'sms'] as const;
export const contactOutcomes = ['contacted', 'no_answer', 'needs_help', 'demo_planned', 'interested', 'not_interested'] as const;
export const caseStatuses = ['open', 'in_progress', 'paused', 'closed', 'do_not_contact'] as const;
export type CaseStatus = typeof caseStatuses[number];
export type ContactChannel = typeof contactChannels[number];
export type MessageChannel = Exclude<ContactChannel, 'call'>;
export const whatsappTemplate = z.object({
  id: z.string().regex(/^\d{1,30}$/), name: z.string().regex(/^[a-z0-9_]{1,512}$/),
  language: z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/),
  body: z.string().min(1).max(3000), footer: z.string().max(300),
  parameters: z.array(z.string().trim().min(1).max(300).regex(/^[^\r\n\t]+$/)).max(10),
}).strict();
export type WhatsAppTemplate = z.infer<typeof whatsappTemplate>;
export type WhatsAppSender = { id: string; accountId: string; phoneNumber: string; name: string };
export type WhatsAppCatalog = { configured: boolean; enabled: boolean; senders: WhatsAppSender[]; templates: Omit<WhatsAppTemplate, 'parameters'>[] };
export const deliveryStatuses = ['dispatching', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown'] as const;
export type DeliveryStatus = typeof deliveryStatuses[number];
export type ContactDelivery = {
  id: string; approvalId: string; recipient: string; text: string; actorName: string;
  status: DeliveryStatus; providerId: string | null; errorCode: string | null;
  createdAt: string; updatedAt: string; sender?: WhatsAppSender;
};
export type DeliveryHistory = { action: 'delivery'; deliveryId: string; status: DeliveryStatus; recipient: string; errorCode: string | null; text?: string; sender?: WhatsAppSender };
export const sendContactCommand = z.object({ requestId: z.uuid(), expectedVersion: z.number().int().min(1), approvalId: z.uuid(), consentConfirmed: z.literal(true) }).strict();
const base = { requestId: z.uuid(), expectedVersion: z.number().int().min(0) };
const plan = {
  status: z.enum(caseStatuses), nextAction: z.string().trim().max(300), nextActionDate: z.iso.date().nullable(),
  note: z.string().trim().min(3).max(2000),
};
export const contactCommand = z.discriminatedUnion('action', [
  z.object({ ...base, ...plan, action: z.literal('contact'), channel: z.enum(contactChannels), outcome: z.enum(contactOutcomes), contactAt: z.iso.datetime() }).strict(),
  z.object({ ...base, ...plan, action: z.literal('plan') }).strict(),
  z.object({ ...base, action: z.literal('save_message'), channel: z.enum(['whatsapp', 'email', 'sms']), language: z.enum(['fr', 'en']), text: z.string().trim().min(10).max(3000), contextFingerprint: z.string().regex(/^[a-f0-9]{64}$/), whatsappTemplate: whatsappTemplate.optional(), whatsappSenderId: z.string().regex(/^\d{1,30}$/).optional() }).strict(),
  z.object({ ...base, action: z.enum(['approve_message', 'cancel_message']) }).strict(),
]);
export type ContactCommand = z.infer<typeof contactCommand>;
export type ContactMessage = {
  text: string; channel: MessageChannel; language: 'fr' | 'en'; reason: FollowUpReason;
  contextFingerprint: string; status: 'draft' | 'approved'; approvedAt: string | null; approvedBy: string | null;
  approvalId?: string; deliveryId?: string; whatsappTemplate?: WhatsAppTemplate; whatsappSender?: WhatsAppSender;
};
export type ContactCase = {
  version: number; reviewRevision: number; status: CaseStatus; nextAction: string; nextActionDate: string | null;
  lastContactAt: string | null; lastContactOutcome: typeof contactOutcomes[number] | null;
  message: ContactMessage | null;
};
export type ContactEntry = {
  account: DecisionRegistration; tracking: ContactCase; contextFingerprint: string;
  messageStale: boolean; approvalBlocked: boolean; due: boolean;
};
export type ContactHistoryEvent = {
  id: string; actorName: string; createdAt: string; data: ContactCommand | DeliveryHistory;
};
export type ContactDetail = ContactEntry & {
  suggestion: { fr: string; en: string };
  history: { items: ContactHistoryEvent[]; total: number; offset: number; limit: number };
  deliveries: ContactDelivery[];
};
export type ContactDirectory = {
  items: ContactEntry[]; total: number; offset: number; limit: number;
  counts: { all: number; due: number; drafts: number; approved: number };
};
