import { z } from 'zod';
import type { DecisionRegistration, FollowUpReason } from './platform-admin-decision';

export const contactChannels = ['whatsapp', 'email', 'call', 'sms'] as const;
export const contactOutcomes = ['contacted', 'no_answer', 'needs_help', 'demo_planned', 'interested', 'not_interested'] as const;
export const caseStatuses = ['open', 'in_progress', 'paused', 'closed', 'do_not_contact'] as const;
export type CaseStatus = typeof caseStatuses[number];
export type ContactChannel = typeof contactChannels[number];
export type MessageChannel = Exclude<ContactChannel, 'call'>;
const base = { requestId: z.uuid(), expectedVersion: z.number().int().min(0) };
const plan = {
  status: z.enum(caseStatuses), nextAction: z.string().trim().max(300), nextActionDate: z.iso.date().nullable(),
  note: z.string().trim().min(3).max(2000),
};
export const contactCommand = z.discriminatedUnion('action', [
  z.object({ ...base, ...plan, action: z.literal('contact'), channel: z.enum(contactChannels), outcome: z.enum(contactOutcomes), contactAt: z.iso.datetime() }).strict(),
  z.object({ ...base, ...plan, action: z.literal('plan') }).strict(),
  z.object({ ...base, action: z.literal('save_message'), channel: z.enum(['whatsapp', 'email', 'sms']), language: z.enum(['fr', 'en']), text: z.string().trim().min(10).max(3000), contextFingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ ...base, action: z.enum(['approve_message', 'cancel_message']) }).strict(),
]);
export type ContactCommand = z.infer<typeof contactCommand>;
export type ContactMessage = {
  text: string; channel: MessageChannel; language: 'fr' | 'en'; reason: FollowUpReason;
  contextFingerprint: string; status: 'draft' | 'approved'; approvedAt: string | null; approvedBy: string | null;
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
  id: string; actorName: string; createdAt: string; data: ContactCommand;
};
export type ContactDetail = ContactEntry & {
  suggestion: { fr: string; en: string };
  history: { items: ContactHistoryEvent[]; total: number; offset: number; limit: number };
};
export type ContactDirectory = {
  items: ContactEntry[]; total: number; offset: number; limit: number;
  counts: { all: number; due: number; drafts: number; approved: number };
};
