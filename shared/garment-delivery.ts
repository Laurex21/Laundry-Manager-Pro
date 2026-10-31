// Controls are optional. An unresolved treatment return remains a separate blocker.
export function canDeliverGarments(items: Array<{ returnedForTreatment?: boolean | null; resolvedAt?: Date | string | null }>): boolean {
  return items.every(item => !item.returnedForTreatment || Boolean(item.resolvedAt));
}
