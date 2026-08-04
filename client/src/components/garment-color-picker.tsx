import { Ban, Check, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { GARMENT_COLORS, GARMENT_COLOR_VALUES } from "@/lib/garment-colors";
import { cn } from "@/lib/utils";

export function GarmentColorPicker({ value, onChange, testId }: { value?: string | null; onChange: (value: string) => void; testId?: string }) {
  const { t } = useTranslation();
  const isCustom = Boolean(value && !GARMENT_COLOR_VALUES.has(value));

  return <div className="space-y-2" data-testid={testId}>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("garment_color")}>
      <button type="button" onClick={() => onChange("")} aria-pressed={!value} aria-label={t("no_color")} title={t("no_color")} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 bg-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", !value ? "border-primary ring-2 ring-primary/20" : "border-border")}>
        {!value ? <Check className="h-5 w-5" aria-hidden="true" /> : <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </button>
      {GARMENT_COLORS.map((color) => {
        const selected = value === color.value;
        return <button key={color.value} type="button" onClick={() => onChange(color.value)} aria-pressed={selected} aria-label={t(`color_${color.value}`)} title={t(`color_${color.value}`)} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", selected ? "border-primary ring-2 ring-primary/30" : "border-border")} style={{ background: color.swatch }}>
          {selected && <Check className={cn("h-5 w-5 drop-shadow", ["white", "yellow", "beige"].includes(color.value) ? "text-slate-900" : "text-white")} strokeWidth={3} aria-hidden="true" />}
        </button>;
      })}
      <button type="button" onClick={() => onChange(isCustom ? value! : t("custom_color_default"))} aria-pressed={isCustom} aria-label={t("color_other")} title={t("color_other")} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", isCustom ? "border-primary ring-2 ring-primary/20" : "border-border")}>
        <Palette className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    {isCustom && <Input aria-label={t("custom_color")} value={value || ""} maxLength={40} onChange={(event) => onChange(event.target.value)} placeholder={t("custom_color_placeholder")} />}
  </div>;
}
