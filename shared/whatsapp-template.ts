import type { WhatsAppTemplate } from './platform-contact';

export function templateParameterCount(body: string): number {
  const indexes = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
  const count = Math.max(0, ...indexes);
  if (count > 10 || body.replace(/\{\{\d+\}\}/g, '').includes('{{') || indexes.includes(0)
    || Array.from({ length: count }, (_, i) => i + 1).some(n => !indexes.includes(n))) return -1;
  return count;
}
export function renderWhatsAppTemplate(template: WhatsAppTemplate): string {
  if (templateParameterCount(template.body) !== template.parameters.length) throw Error('CONTACT_TEMPLATE_INVALID');
  return [template.body.replace(/\{\{(\d+)\}\}/g, (_, n) => template.parameters[Number(n) - 1]), template.footer].filter(Boolean).join('\n\n');
}
