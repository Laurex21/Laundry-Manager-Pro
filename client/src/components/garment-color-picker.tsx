import { useState } from "react";
import { Ban, Check, ChevronDown, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  GARMENT_COLORS,
  GARMENT_COLOR_FAMILIES,
  GARMENT_COLOR_VALUES,
  POPULAR_GARMENT_COLORS,
} from "@/lib/garment-colors";
import { cn } from "@/lib/utils";

const RECENT_COLORS_KEY = "xpresspro-recent-garment-colors";

type GarmentColor = (typeof GARMENT_COLORS)[number];

function colorCheckClass(value: string) {
  return ["white", "cream", "yellow", "beige", "light_grey", "sky_blue", "mint", "light_pink", "lavender", "lilac", "silver"].includes(value)
    ? "text-slate-900"
    : "text-white";
}

export function GarmentColorPicker({ value, onChange, testId, compact = false }: { value?: string | null; onChange: (value: string) => void; testId?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mosaicOpen, setMosaicOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [recentValues, setRecentValues] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECENT_COLORS_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((item): item is string => GARMENT_COLOR_VALUES.has(item)).slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const isCustom = Boolean(value && !GARMENT_COLOR_VALUES.has(value));
  const selectedColor = GARMENT_COLORS.find((color) => color.value === value);
  const recentColors = recentValues
    .map((recentValue) => GARMENT_COLORS.find((color) => color.value === recentValue))
    .filter((color): color is GarmentColor => Boolean(color));

  function rememberColor(colorValue: string) {
    if (!GARMENT_COLOR_VALUES.has(colorValue)) return;
    const next = [colorValue, ...recentValues.filter((item) => item !== colorValue)].slice(0, 6);
    setRecentValues(next);
    try {
      window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
    } catch {
      // The selection still works when browser storage is unavailable.
    }
  }

  function selectColor(colorValue: string) {
    onChange(colorValue);
    rememberColor(colorValue);
    setOpen(false);
    setMosaicOpen(false);
  }

  function openMosaic() {
    setCustomDraft(isCustom ? value || "" : "");
    setOpen(false);
    setMosaicOpen(true);
  }

  function ColorButton({ color, showLabel = false }: { color: GarmentColor; showLabel?: boolean }) {
    const selected = value === color.value;
    const label = t(`color_${color.value}`);
    return (
      <button
        type="button"
        onClick={() => selectColor(color.value)}
        aria-pressed={selected}
        aria-label={label}
        title={label}
        className={cn(
          "group flex min-h-11 items-center justify-center rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          showLabel ? "flex-col gap-1.5 px-1 py-2" : "h-11 w-11 rounded-full",
          selected ? "border-primary bg-primary/5 ring-2 ring-primary/25" : "border-transparent hover:border-border",
        )}
      >
        <span className={cn("flex shrink-0 items-center justify-center rounded-full border border-black/10 shadow-sm", showLabel ? "h-10 w-10" : "h-11 w-11")} style={{ background: color.swatch }} aria-hidden="true">
          {selected && <Check className={cn("h-5 w-5 drop-shadow", colorCheckClass(color.value))} strokeWidth={3} />}
        </span>
        {showLabel && <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight">{label}</span>}
      </button>
    );
  }

  const quickPalette = (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("garment_color") }>
      <button type="button" onClick={() => { onChange(""); setOpen(false); }} aria-pressed={!value} aria-label={t("no_color")} title={t("no_color")} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", !value ? "border-primary ring-2 ring-primary/20" : "border-border")}>
        {!value ? <Check className="h-5 w-5" aria-hidden="true" /> : <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </button>
      {POPULAR_GARMENT_COLORS.map((color) => <ColorButton key={color.value} color={color} />)}
      <button type="button" onClick={openMosaic} aria-expanded={mosaicOpen} aria-label={t("garment_color_more")} title={t("garment_color_more")} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Palette className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );

  const mosaic = (
    <Dialog open={mosaicOpen} onOpenChange={setMosaicOpen}>
      <DialogContent className="max-h-[88dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{t("garment_color_mosaic_title")}</DialogTitle>
          <DialogDescription>{t("garment_color_mosaic_hint")}</DialogDescription>
        </DialogHeader>
        <button type="button" onClick={() => { onChange(""); setMosaicOpen(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border"><Ban className="h-4 w-4" aria-hidden="true" /></span>
          {t("no_color")}
        </button>
        {recentColors.length > 0 && (
          <section aria-labelledby="recent-colors-heading">
            <h3 id="recent-colors-heading" className="mb-2 text-sm font-semibold">{t("garment_color_recent")}</h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{recentColors.map((color) => <ColorButton key={`recent-${color.value}`} color={color} showLabel />)}</div>
          </section>
        )}
        {GARMENT_COLOR_FAMILIES.map((family) => {
          const colors = GARMENT_COLORS.filter((color) => color.family === family);
          return (
            <section key={family} aria-labelledby={`color-family-${family}`}>
              <h3 id={`color-family-${family}`} className="mb-2 text-sm font-semibold">{t(`garment_color_family_${family}`)}</h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{colors.map((color) => <ColorButton key={color.value} color={color} showLabel />)}</div>
            </section>
          );
        })}
        <section className="rounded-xl border bg-muted/30 p-3" aria-labelledby="custom-color-heading">
          <h3 id="custom-color-heading" className="text-sm font-semibold">{t("custom_color")}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{t("custom_color_hint")}</p>
          <div className="flex gap-2">
            <Input aria-label={t("custom_color")} value={customDraft} maxLength={40} onChange={(event) => setCustomDraft(event.target.value)} placeholder={t("custom_color_placeholder")} />
            <Button type="button" disabled={!customDraft.trim()} onClick={() => { onChange(customDraft.trim()); setMosaicOpen(false); }}>{t("apply")}</Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-10 w-full justify-between px-3 font-normal" data-testid={testId} aria-label={t("select_color")}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-6 w-6 shrink-0 rounded-full border" style={{ background: selectedColor?.swatch || (isCustom ? "hsl(var(--muted))" : "transparent") }} aria-hidden="true" />
              <span className="truncate">{selectedColor ? t(`color_${selectedColor.value}`) : isCustom ? value : t("no_color")}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-3" align="start">
          {quickPalette}
          <Button type="button" variant="ghost" className="mt-2 w-full justify-start text-primary" onClick={openMosaic}>
            <Palette className="mr-2 h-4 w-4" aria-hidden="true" />{t("garment_color_more")}
          </Button>
        </PopoverContent>
      </Popover>
      {mosaic}
    </>;
  }

  return <div className="space-y-2" data-testid={testId}>
    {quickPalette}
    <Button type="button" variant="outline" className="w-full justify-start" onClick={openMosaic}><Palette className="mr-2 h-4 w-4" aria-hidden="true" />{t("garment_color_more")}</Button>
    {mosaic}
  </div>;
}
