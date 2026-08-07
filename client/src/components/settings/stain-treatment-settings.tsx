import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  STAIN_TREATMENT_LEVELS, STAIN_TREATMENT_UNITS, validateAscendingRates,
  type StainTreatmentLevel, type StainTreatmentRateInput, type StainTreatmentUnit,
} from "@shared/stain-treatment";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { useReplaceStainTreatmentPrices, useStainTreatmentPrices } from "@/hooks/use-stain-treatment";

const emptyRates = (): StainTreatmentRateInput[] => STAIN_TREATMENT_UNITS.flatMap((unit) =>
  STAIN_TREATMENT_LEVELS.map((level) => ({ unit, level, price: "" })),
);
const keyOf = (unit: StainTreatmentUnit, level: StainTreatmentLevel) => `${unit}:${level}`;

export function StainTreatmentSettings({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const prices = useStainTreatmentPrices(canManage);
  const save = useReplaceStainTreatmentPrices();
  const [rates, setRates] = useState<StainTreatmentRateInput[]>(emptyRates);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (prices.data?.rates) setRates(prices.data.rates.map(({ level, unit, price }) => ({ level, unit, price })));
  }, [prices.data]);

  const byKey = useMemo(() => new Map(rates.map((rate) => [keyOf(rate.unit, rate.level), rate.price])), [rates]);
  const setPrice = (unit: StainTreatmentUnit, level: StainTreatmentLevel, price: string) => {
    setRates((current) => current.map((rate) => rate.unit === unit && rate.level === level ? { ...rate, price } : rate));
    setErrors((current) => { const next = { ...current }; delete next[keyOf(unit, level)]; return next; });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAnnouncement("");
    const nextErrors: Record<string, string> = {};
    rates.forEach((rate) => {
      if (!/^\d+(?:\.\d{1,2})?$/.test(rate.price) || Number(rate.price) <= 0) nextErrors[keyOf(rate.unit, rate.level)] = t("stain_treatment_positive_price");
    });
    const ascending = validateAscendingRates(rates);
    if (!ascending.success) {
      STAIN_TREATMENT_UNITS.forEach((unit) => {
        if (!nextErrors[keyOf(unit, "standard")]) nextErrors[keyOf(unit, "standard")] = t("stain_treatment_prices_ascending");
      });
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setAnnouncement(t("stain_treatment_fix_errors"));
      refs.current[Object.keys(nextErrors)[0]]?.focus();
      return;
    }
    try {
      await save.mutateAsync({ rates });
      setErrors({});
      setAnnouncement(t("stain_treatment_saved"));
    } catch (error: any) {
      let message = t("stain_treatment_save_error");
      try {
        const payload = JSON.parse(String(error?.message || "").replace(/^\d+:\s*/, ""));
        if (payload?.issues?.[0]?.path?.length) {
          message = payload.issues[0].message || message;
          for (const issue of payload.issues) {
            const index = issue?.path?.[0] === "rates" && Number.isInteger(issue?.path?.[1]) ? issue.path[1] : -1;
            const rate = rates[index];
            if (rate) nextErrors[keyOf(rate.unit, rate.level)] = issue.message || message;
          }
          if (Object.keys(nextErrors).length) {
            setErrors(nextErrors);
            refs.current[Object.keys(nextErrors)[0]]?.focus();
          }
        }
        else if (payload?.message) message = payload.message;
      } catch { /* retain localized generic message */ }
      setAnnouncement(message);
    }
  };

  if (!canManage) return null;
  if (prices.isLoading) return <div aria-label={t("loading")} className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (prices.isError) return <Alert variant="destructive"><AlertTitle>{t("error")}</AlertTitle><AlertDescription>{t("stain_treatment_load_error")}</AlertDescription></Alert>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("stain_treatment_settings")}</CardTitle>
        <CardDescription>{t("stain_treatment_settings_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!prices.data && <Alert className="mb-5"><AlertTitle>{t("stain_treatment_missing")}</AlertTitle><AlertDescription>{t("stain_treatment_missing_guidance")}</AlertDescription></Alert>}
        <form onSubmit={submit} noValidate className="space-y-6">
          <p className="text-sm text-muted-foreground">{t("stain_treatment_currency")}: <strong>{prices.data?.currency ?? t("stain_treatment_organisation_currency")}</strong></p>
          {STAIN_TREATMENT_UNITS.map((unit) => (
            <fieldset key={unit} className="rounded-lg border p-4">
              <legend className="px-2 font-semibold">{t(unit === "piece" ? "stain_treatment_per_piece" : "stain_treatment_per_kg")}</legend>
              <div className="grid gap-4 md:grid-cols-3">
                {STAIN_TREATMENT_LEVELS.map((level) => {
                  const fieldKey = keyOf(unit, level);
                  const labelKey = level === "very_intensive" ? "stain_treatment_very_intensive" : `stain_treatment_${level}`;
                  return <div key={level} className="space-y-2">
                    <Label htmlFor={`stain-rate-${fieldKey}`}>{t(labelKey)}</Label>
                    <p id={`stain-help-${fieldKey}`} className="min-h-10 text-xs text-muted-foreground">{t(`${labelKey}_definition`)}</p>
                    <Input id={`stain-rate-${fieldKey}`} ref={(node) => { refs.current[fieldKey] = node; }} inputMode="decimal" value={byKey.get(fieldKey) ?? ""} onChange={(event) => setPrice(unit, level, event.target.value)} aria-describedby={`stain-help-${fieldKey}${errors[fieldKey] ? ` stain-error-${fieldKey}` : ""}`} aria-invalid={Boolean(errors[fieldKey])} disabled={save.isPending} data-testid={`input-stain-rate-${fieldKey}`} />
                    {errors[fieldKey] && <p id={`stain-error-${fieldKey}`} className="text-sm text-destructive">{errors[fieldKey]}</p>}
                  </div>;
                })}
              </div>
            </fieldset>
          ))}
          {prices.data && <p className="text-xs text-muted-foreground">{prices.data.updatedAt && prices.data.updatedBy
            ? t("stain_treatment_last_updated", { version: prices.data.version, actor: prices.data.updatedBy, date: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(prices.data.updatedAt)) })
            : t("stain_treatment_version", { version: prices.data.version })}</p>}
          <div aria-live="assertive" className="text-sm text-destructive">{save.isError ? announcement : ""}</div>
          <div aria-live="polite" className="text-sm text-muted-foreground">{!save.isError ? announcement : ""}</div>
          <Button type="submit" disabled={save.isPending} className="min-h-11" data-testid="button-save-stain-treatment-prices">
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />{save.isPending ? t("saving") : t("stain_treatment_save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
