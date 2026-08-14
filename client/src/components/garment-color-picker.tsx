import { useState } from "react";
import { Ban, Check, ChevronDown, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GARMENT_COLORS, GARMENT_COLOR_VALUES } from "@/lib/garment-colors";
import { cn } from "@/lib/utils";

export function GarmentColorPicker({ value, onChange, testId, compact = false }: { value?: string | null; onChange: (value: string) => void; testId?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isCustom = Boolean(value && !GARMENT_COLOR_VALUES.has(value));
  const selectedColor = GARMENT_COLORS.find((color) => color.value === value);

  const palette = <>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("garment_color")}>
      <button type="button" onClick={() => { onChange(""); setOpen(false); }} aria-pressed={!value} aria-label={t("no_color")} title={t("no_color")} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 bg-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", !value ? "border-primary ring-2 ring-primary/20" : "border-border")}>
        {!value ? <Check className="h-5 w-5" aria-hidden="true" /> : <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </button>
      {GARMENT_COLORS.map((color) => {
        const selected = value === color.value;
        return <button key={color.value} type="button" onClick={() => { onChange(color.value); setOpen(false); }} aria-pressed={selected} aria-label={t(`color_${color.value}`)} title={t(`color_${color.value}`)} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", selected ? "border-primary ring-2 ring-primary/30" : "border-border")} style={{ background: color.swatch }}>
          {selected && <Check className={cn("h-5 w-5 drop-shadow", ["white", "yellow", "beige"].includes(color.value) ? "text-slate-900" : "text-white")} strokeWidth={3} aria-hidden="true" />}
        </button>;
      })}
      <button type="button" onClick={() => onChange(isCustom ? value! : t("custom_color_default"))} aria-pressed={isCustom} aria-label={t("color_other")} title={t("color_other")} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", isCustom ? "border-primary ring-2 ring-primary/20" : "border-border")}>
        <Palette className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    {isCustom && <Input className="mt-2" aria-label={t("custom_color")} value={value || ""} maxLength={40} onChange={(event) => onChange(event.target.value)} placeholder={t("custom_color_placeholder")} />}
  </>;

  if (compact) {
    return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 w-full justify-between px-3 font-normal" data-testid={testId} aria-label={t("select_color")}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-6 w-6 shrink-0 rounded-full border" style={{ background: selectedColor?.swatch || (isCustom ? "hsl(var(--muted))" : "transparent") }} aria-hidden="true" />
            <span className="truncate">{selectedColor ? t(`color_${selectedColor.value}`) : isCustom ? value : t("no_color")}</span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-3" align="start">{palette}</PopoverContent>
    </Popover>;
  }

  return <div className="space-y-2" data-testid={testId}>
    {palette}
  </div>;
}
