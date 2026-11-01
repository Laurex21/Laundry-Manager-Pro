import { orderDisplayId, orderClassicNumber, type OrderDisplaySource } from '@/lib/order-display';
import { accessCopy } from '@/lib/access-feedback';
import { useTranslation } from 'react-i18next';
export function OrderIdentity({order}: {order: OrderDisplaySource}) {
  const {i18n}=useTranslation();
  const code=String(orderDisplayId(order)); const classic=orderClassicNumber(order);
  return <span className="inline-flex min-w-0 flex-col items-start gap-0.5" data-testid="order-identity"><span className="break-all font-mono">{code}</span>{classic && classic !== code && <span className="text-xs font-normal text-muted-foreground">{accessCopy(i18n.language).number} : {classic}</span>}</span>;
}
