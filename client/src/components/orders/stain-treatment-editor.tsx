import { useEffect, useMemo, useRef } from "react";
import Decimal from "decimal.js-light";
import { Plus, Trash2, Droplets, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Service } from "@shared/schema";
import {
  STAIN_TREATMENT_LEVELS,
  multiplyTreatmentAmount,
  validateTreatmentQuantity,
  type StainTreatmentDraftInput,
  type StainTreatmentLevel,
  type StainTreatmentUnit,
} from "@shared/stain-treatment";
import { useStainTreatmentPrices } from "@/hooks/use-stain-treatment";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const VERY_INTENSIVE_ACKNOWLEDGEMENT_VERSION = "stain-removal-not-guaranteed-v1";

export function normalizeLocaleDecimal(value: string): string {
  return value.trim().replace(/\s/g, "").replace(",", ".");
}

function stableDraftKey(): string {
  return `stain-${crypto.randomUUID()}`;
}

function treatmentUnit(service?: Service): StainTreatmentUnit {
  return String(service?.unit || "").toLocaleLowerCase().includes("kg") ? "kg" : "piece";
}

interface StainTreatmentEditorProps {
  services: Service[];
  items: Array<{ serviceId: number; quantity: number }>;
  value: StainTreatmentDraftInput[];
  onChange: (drafts: StainTreatmentDraftInput[]) => void;
  onSubtotalChange: (subtotal: string) => void;
  onValidityChange: (valid: boolean) => void;
  disabled?: boolean;
}

export function StainTreatmentEditor({ services, items, value, onChange, onSubtotalChange, onValidityChange, disabled }: StainTreatmentEditorProps) {
  const { t } = useTranslation();
  const { data: pricing, isLoading, isError } = useStainTreatmentPrices();
  const previousServices = useRef(items.map((item) => item.serviceId).join(","));

  const serviceFor = (orderItemIndex: number) => services.find((service) => service.id === items[orderItemIndex]?.serviceId);
  const rateFor = (orderItemIndex: number, level: StainTreatmentLevel) => {
    const unit = treatmentUnit(serviceFor(orderItemIndex));
    return pricing?.rates.find((rate) => rate.level === level && rate.unit === unit);
  };

  const aggregateErrors = useMemo(() => {
    const errors = new Map<number, string>();
    items.forEach((item, itemIndex) => {
      const aggregate = value
        .filter((draft) => draft.orderItemIndex === itemIndex)
        .reduce((sum, draft) => {
          try { return sum.plus(new Decimal(draft.quantity || "0")); } catch { return sum; }
        }, new Decimal(0));
      if (aggregate.greaterThan(String(item.quantity || 0))) errors.set(itemIndex, t("stain_treatment_quantity_exceeded"));
    });
    return errors;
  }, [items, value, t]);

  const subtotal = useMemo(() => value.reduce((sum, draft) => {
    const rate = rateFor(draft.orderItemIndex, draft.level);
    if (!rate) return sum;
    try { return sum.plus(new Decimal(multiplyTreatmentAmount(rate.price, draft.quantity))); } catch { return sum; }
  }, new Decimal(0)).toFixed(2), [value, pricing, items, services]);

  useEffect(() => onSubtotalChange(subtotal), [subtotal, onSubtotalChange]);
  useEffect(() => {
    const valid = aggregateErrors.size === 0 && value.every((draft) => {
      const unit = treatmentUnit(serviceFor(draft.orderItemIndex));
      return Boolean(rateFor(draft.orderItemIndex, draft.level))
        && validateTreatmentQuantity(unit, draft.quantity).success
        && (draft.level !== "very_intensive" || draft.acknowledgement?.affirmed === true);
    });
    onValidityChange(valid);
  }, [aggregateErrors, value, pricing, items, services, onValidityChange]);

  useEffect(() => {
    const signature = items.map((item) => item.serviceId).join(",");
    if (signature === previousServices.current) return;
    const prior = previousServices.current.split(",");
    previousServices.current = signature;
    onChange(value
      .filter((draft) => Boolean(items[draft.orderItemIndex]?.serviceId))
      .map((draft) => prior[draft.orderItemIndex] === String(items[draft.orderItemIndex]?.serviceId)
        ? draft
        : { ...draft, level: "standard", quantity: "1", acknowledgement: undefined }));
  }, [items, onChange, value]);

  const addTreatment = () => {
    const orderItemIndex = items.findIndex((item) => item.serviceId > 0);
    if (orderItemIndex < 0) return;
    onChange([...value, { orderItemIndex, level: "standard", quantity: "1", idempotencyKey: stableDraftKey() }]);
  };

  const update = (index: number, next: StainTreatmentDraftInput) => onChange(value.map((draft, draftIndex) => draftIndex === index ? next : draft));

  if (isLoading) return <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (isError || !pricing) return (
    <Alert variant="destructive" data-testid="stain-treatment-missing-pricing">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{t("stain_treatment_missing")}</AlertTitle>
      <AlertDescription>{t("stain_treatment_missing_order")}</AlertDescription>
    </Alert>
  );

  return (
    <fieldset className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/20" disabled={disabled}>
      <legend className="px-2 text-sm font-semibold text-sky-950 dark:text-sky-100">
        <span className="inline-flex items-center gap-2"><Droplets className="h-4 w-4" aria-hidden="true" />{t("stain_treatment_add")}</span>
      </legend>
      <p id="stain-treatment-definition" className="text-xs text-muted-foreground">{t("stain_treatment_order_definition")}</p>
      <div className="grid gap-2 sm:grid-cols-3" aria-label={t("stain_treatment_level")}>
        {STAIN_TREATMENT_LEVELS.map((level) => (
          <div key={level} className="rounded-md border bg-background/70 p-2 text-xs">
            <p className="font-semibold">{t(`stain_treatment_${level}`)}</p>
            <p className="mt-1 text-muted-foreground">{t(`stain_treatment_${level}_definition`)}</p>
          </div>
        ))}
      </div>

      {value.map((draft, index) => {
        const selectedService = serviceFor(draft.orderItemIndex);
        const unit = treatmentUnit(selectedService);
        const rate = rateFor(draft.orderItemIndex, draft.level);
        const quantityValidation = validateTreatmentQuantity(unit, draft.quantity);
        const error = aggregateErrors.get(draft.orderItemIndex) || (!quantityValidation.success ? t("stain_treatment_invalid_quantity") : "");
        const definitionId = `stain-treatment-level-definition-${index}`;
        return (
          <div key={draft.idempotencyKey} className="space-y-3 rounded-lg border bg-background p-3" data-testid={`stain-treatment-row-${index}`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor={`stain-service-${index}`}>{t("stain_treatment_related_service")}</Label>
                <Select value={String(draft.orderItemIndex)} onValueChange={(next) => update(index, { ...draft, orderItemIndex: Number(next), level: "standard", quantity: "1", acknowledgement: undefined })}>
                  <SelectTrigger id={`stain-service-${index}`} className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{items.map((item, itemIndex) => {
                    const service = services.find((candidate) => candidate.id === item.serviceId);
                    return service ? <SelectItem key={`${itemIndex}-${service.id}`} value={String(itemIndex)}>{service.name}</SelectItem> : null;
                  })}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`stain-unit-${index}`}>{t("unit")}</Label>
                <Input id={`stain-unit-${index}`} value={unit === "kg" ? t("stain_treatment_per_kg") : t("stain_treatment_per_piece")} readOnly className="min-h-11 bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`stain-level-${index}`}>{t("stain_treatment_level")}</Label>
                <Select value={draft.level} onValueChange={(level: StainTreatmentLevel) => update(index, { ...draft, level, acknowledgement: level === "very_intensive" ? draft.acknowledgement : undefined })}>
                  <SelectTrigger id={`stain-level-${index}`} aria-describedby={definitionId} className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAIN_TREATMENT_LEVELS.map((level) => <SelectItem key={level} value={level}>{t(`stain_treatment_${level}`)}</SelectItem>)}</SelectContent>
                </Select>
                <p id={definitionId} className="text-xs text-muted-foreground">{t(`stain_treatment_${draft.level}_definition`)}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`stain-quantity-${index}`}>{t("stain_treatment_affected_quantity")}</Label>
                <Input
                  id={`stain-quantity-${index}`}
                  inputMode="decimal"
                  value={draft.quantity}
                  aria-describedby={`stain-quantity-help-${index}`}
                  aria-invalid={Boolean(error)}
                  onChange={(event) => update(index, { ...draft, quantity: normalizeLocaleDecimal(event.target.value) })}
                  className="min-h-11"
                />
                <p id={`stain-quantity-help-${index}`} aria-live={error ? "assertive" : "polite"} className={error ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{error || t("stain_treatment_quantity_limit", { quantity: items[draft.orderItemIndex]?.quantity ?? 0 })}</p>
              </div>
            </div>

            {draft.level === "very_intensive" && (
              <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <Checkbox
                  id={`stain-ack-${index}`}
                  checked={draft.acknowledgement?.affirmed === true}
                  aria-describedby={`stain-ack-help-${index}`}
                  onCheckedChange={(checked) => update(index, { ...draft, acknowledgement: checked === true ? { affirmed: true, textVersion: VERY_INTENSIVE_ACKNOWLEDGEMENT_VERSION } : undefined })}
                  className="mt-0.5 min-h-5 min-w-5"
                />
                <Label htmlFor={`stain-ack-${index}`} className="flex min-h-11 cursor-pointer items-center text-sm leading-5">{t("stain_treatment_very_intensive_acknowledgement")}</Label>
                {!draft.acknowledgement && <p id={`stain-ack-help-${index}`} role="alert" className="text-xs font-semibold text-destructive">{t("stain_treatment_acknowledgement_required")}</p>}
              </div>
            )}

            <div className="flex min-h-11 items-center justify-between gap-3 border-t pt-3">
              <p aria-live="polite" className="text-sm">
                {t("stain_treatment_rate_preview")}: <strong>{pricing.currency} {rate?.price ?? "—"}</strong> · {t("stain_treatment_subtotal")}: <strong>{pricing.currency} {rate && quantityValidation.success ? multiplyTreatmentAmount(rate.price, draft.quantity) : "—"}</strong>
              </p>
              <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 text-destructive" onClick={() => onChange(value.filter((_, draftIndex) => draftIndex !== index))} aria-label={t("remove")}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={addTreatment} disabled={!items.some((item) => item.serviceId > 0)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />{t("stain_treatment_add")}
        </Button>
        <p aria-live="polite" className="text-sm font-semibold">{t("stain_treatment_subtotal")}: {pricing.currency} {subtotal}</p>
      </div>
    </fieldset>
  );
}
