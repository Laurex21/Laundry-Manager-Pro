import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_SETTINGS, DEFAULT_TERMS_EN, type ReceiptSettings } from "@/lib/receipt-settings";
import { clearWhatsAppDevicePreference } from "@/components/whatsapp-launcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2, Receipt, FileText, Users, Save, Plus, Trash2, Copy,
  Link as LinkIcon, Shield, Clock, Upload, X, Globe2, MoreVertical,
  MessageCircle,
  Gift,
  Sparkles,
} from "lucide-react";
import { StainTreatmentSettings } from "@/components/settings/stain-treatment-settings";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { enUS, fr, pt } from "date-fns/locale";

function dateLocaleFor(language: string) {
  if (language.startsWith("fr")) return fr;
  if (language.startsWith("pt")) return pt;
  return enUS;
}

// ─── Identity Tab ─────────────────────────────────────────────────────────────

function BusinessIdentityTab({ settings, onSave, saving }: { settings: any; onSave: (d: any) => void; saving: boolean }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    businessName: settings.businessName || "",
    companyRegistrationNumber: settings.companyRegistrationNumber || "",
    tagline: settings.tagline || "",
    address: settings.address || "",
    city: settings.city || "",
    country: settings.country || "",
    phone: settings.phone || "",
    phone2: settings.phone2 || "",
    email: settings.email || "",
    website: settings.website || "",
    whatsappAppPreference: settings.whatsappAppPreference || "ask",
    logoBase64: settings.logoBase64 || "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert(t("logo_file_size_error"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, logoBase64: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const F = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="businessName">{t("business_name_label")}</Label>
          <Input id="businessName" value={form.businessName} onChange={F("businessName")} placeholder={t("business_name_placeholder")} data-testid="input-business-name" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="companyRegistrationNumber">{t("company_registration_number")}</Label>
          <Input
            id="companyRegistrationNumber"
            value={form.companyRegistrationNumber}
            onChange={F("companyRegistrationNumber")}
            placeholder={t("company_registration_number_placeholder")}
            data-testid="input-company-registration-number"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="tagline">{t("tagline")}</Label>
          <Input id="tagline" value={form.tagline} onChange={F("tagline")} placeholder={t("tagline_placeholder")} data-testid="input-tagline" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t("phone_primary")}</Label>
          <Input id="phone" value={form.phone} onChange={F("phone")} placeholder="+237 655 000 000" data-testid="input-phone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone2">{t("phone_secondary")}</Label>
          <Input id="phone2" value={form.phone2} onChange={F("phone2")} placeholder="+237 656 000 001" data-testid="input-phone2" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" value={form.email} onChange={F("email")} placeholder="hello@xpresspro.cm" data-testid="input-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">{t("website")}</Label>
          <Input id="website" value={form.website} onChange={F("website")} placeholder="https://xpresspro.cm" data-testid="input-website" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">{t("street_address")}</Label>
          <Input id="address" value={form.address} onChange={F("address")} placeholder={t("street_address_placeholder")} data-testid="input-address" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">{t("city")}</Label>
          <Input id="city" value={form.city} onChange={F("city")} placeholder="Douala" data-testid="input-city" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">{t("country")}</Label>
          <Input id="country" value={form.country} onChange={F("country")} placeholder={t("country_placeholder")} data-testid="input-country" />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-[#128C7E]" aria-hidden="true" />
            {t("whatsapp_messenger")}
          </CardTitle>
          <CardDescription className="text-xs">{t("whatsapp_messenger_description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsappAppPreference">{t("default_whatsapp_app")}</Label>
            <Select
              value={form.whatsappAppPreference}
              onValueChange={(value) => setForm((current) => ({ ...current, whatsappAppPreference: value }))}
            >
              <SelectTrigger id="whatsappAppPreference" data-testid="select-whatsapp-app-preference">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">{t("whatsapp_preference_ask")}</SelectItem>
                <SelectItem value="whatsapp">{t("whatsapp_preference_personal")}</SelectItem>
                <SelectItem value="business">{t("whatsapp_preference_business")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("whatsapp_preference_hint")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearWhatsAppDevicePreference}
            data-testid="button-reset-whatsapp-device-choice"
          >
            {t("reset_whatsapp_device_choice")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("business_logo")}</CardTitle>
          <CardDescription className="text-xs">{t("logo_upload_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {form.logoBase64 ? (
              <div className="relative">
                <img src={form.logoBase64} alt={t("logo_preview_alt")} className="h-16 w-16 object-contain rounded-lg border" />
                <button onClick={() => setForm((f) => ({ ...f, logoBase64: "" }))} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center" data-testid="button-remove-logo">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-muted-foreground/50" />
              </div>
            )}
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} data-testid="input-logo-file" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="button-upload-logo">
                <Upload className="w-4 h-4 mr-2" />
                {form.logoBase64 ? t("change_logo") : t("upload_logo")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => onSave(form)} disabled={saving} data-testid="button-save-identity">
        <Save className="w-4 h-4 mr-2" />
        {saving ? t("saving") : t("save_changes")}
      </Button>
    </div>
  );
}

// ─── Receipt Layout Tab ───────────────────────────────────────────────────────

function ReceiptLayoutTab({ settings, onSave, saving }: { settings: any; onSave: (d: any) => void; saving: boolean }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    receiptHeaderColor: settings.receiptHeaderColor || "#1e3a5f",
    receiptLanguage: settings.receiptLanguage || "en",
    showLogo: settings.showLogo ?? true,
    showPickupDate: settings.showPickupDate ?? true,
    showGarmentList: settings.showGarmentList ?? true,
    showPaymentHistory: settings.showPaymentHistory ?? true,
    showTerms: settings.showTerms ?? true,
    receiptFooterNote: settings.receiptFooterNote || "",
  });

  const LANGUAGE_OPTIONS = [
    { value: "en", label: t("language_english") },
    { value: "fr", label: "Français" },
    { value: "pt", label: "Português" },
    { value: "both", label: t("language_both_en_fr") },
    { value: "all", label: t("language_all_en_fr_pt") },
  ];

  const toggles = [
    { key: "showLogo" as const, labelKey: "show_logo" },
    { key: "showPickupDate" as const, labelKey: "show_pickup_date" },
    { key: "showGarmentList" as const, labelKey: "show_garment_list" },
    { key: "showPaymentHistory" as const, labelKey: "show_payment_history" },
    { key: "showTerms" as const, labelKey: "show_terms" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("header_color")}</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.receiptHeaderColor}
              onChange={(e) => setForm((f) => ({ ...f, receiptHeaderColor: e.target.value }))}
              className="h-10 w-20 cursor-pointer rounded border border-input"
              data-testid="input-header-color"
            />
            <Input
              value={form.receiptHeaderColor}
              onChange={(e) => setForm((f) => ({ ...f, receiptHeaderColor: e.target.value }))}
              className="font-mono text-sm"
              placeholder="#1e3a5f"
              data-testid="input-header-color-text"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("receipt_language")}</Label>
          <Select value={form.receiptLanguage} onValueChange={(v) => setForm((f) => ({ ...f, receiptLanguage: v }))}>
            <SelectTrigger data-testid="select-receipt-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t("footer_note")}</Label>
          <Input
            value={form.receiptFooterNote}
            onChange={(e) => setForm((f) => ({ ...f, receiptFooterNote: e.target.value }))}
            placeholder="Thank you for your trust · Merci de votre confiance · Obrigado pela confiança"
            data-testid="input-footer-note"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("sections_to_show")}</CardTitle>
          <CardDescription className="text-xs">{t("sections_hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {toggles.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm font-normal">{t(labelKey)}</Label>
              <Switch
                checked={form[key]}
                onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                data-testid={`toggle-${key}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="border rounded-lg overflow-hidden">
        <div className="text-xs p-3 font-bold text-white" style={{ backgroundColor: form.receiptHeaderColor }}>
          <div>
            <div className="text-sm font-bold">{t("business_name")}</div>
            <div className="opacity-80 text-xs">{t("laundry_manager")}</div>
            <div className="mt-2">
              <div className="opacity-70 text-xs">{t("order_id")}</div>
              <div className="text-lg font-black leading-tight">#001</div>
            </div>
          </div>
        </div>
        <div className="p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">{t("receipt_preview")}</p>
          {form.receiptFooterNote && <p className="text-xs text-center mt-2 italic text-muted-foreground">"{form.receiptFooterNote}"</p>}
        </div>
      </div>

      <Button onClick={() => onSave(form)} disabled={saving} data-testid="button-save-layout">
        <Save className="w-4 h-4 mr-2" />
        {saving ? t("saving") : t("save_changes")}
      </Button>
    </div>
  );
}

// ─── Terms Tab ────────────────────────────────────────────────────────────────

function TermsTab({ settings, onSave, saving }: { settings: any; onSave: (d: any) => void; saving: boolean }) {
  const { t } = useTranslation();
  const [termsOfService, setTermsOfService] = useState(settings.termsOfService || DEFAULT_TERMS_EN);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <Label>{t("terms_of_service_label")}</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-2">{t("terms_one_per_line")}</p>
        <Textarea
          value={termsOfService}
          onChange={(e) => setTermsOfService(e.target.value)}
          rows={12}
          className="font-mono text-sm resize-y"
          placeholder={t("terms_placeholder")}
          data-testid="textarea-terms"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave({ termsOfService })} disabled={saving} data-testid="button-save-terms">
          <Save className="w-4 h-4 mr-2" />
          {saving ? t("saving") : t("save_terms")}
        </Button>
        <Button
          variant="outline"
          onClick={() => setTermsOfService(DEFAULT_TERMS_EN)}
          data-testid="button-reset-terms"
        >
          {t("reset_to_default")}
        </Button>
      </div>
    </div>
  );
}

function LoyaltyTab({ settings }: { settings: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(Boolean(settings.loyaltyProgramEnabled));
  const { data: program } = useQuery<any>({ queryKey: ["/api/loyalty-program"] });
  const [form, setForm] = useState({
    pointsPerOrder: 10,
    pointsPerFcfa: "",
    renewalBonus: 50,
    referralBonus: 100,
    pointExpireDays: "",
    isActive: true,
  });
  useEffect(() => {
    if (!program) return;
    setForm({
      pointsPerOrder: Number(program.pointsPerOrder ?? 10),
      pointsPerFcfa: program.pointsPerFcfa ?? "",
      renewalBonus: Number(program.renewalBonus ?? 50),
      referralBonus: Number(program.referralBonus ?? 100),
      pointExpireDays: program.pointExpireDays ?? "",
      isActive: Boolean(program.isActive),
    });
  }, [program]);
  const saveMut = useMutation({
    mutationFn: async () => {
      const programResponse = await fetch("/api/loyalty-program", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          ...form,
          pointsPerFcfa: form.pointsPerFcfa === "" ? null : Number(form.pointsPerFcfa),
          pointExpireDays: form.pointExpireDays === "" ? null : Number(form.pointExpireDays),
        }),
      });
      if (!programResponse.ok) throw new Error(await programResponse.text());
      return programResponse.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/loyalty-program"] });
      toast({ title: t("settings_saved") });
    },
    onError: (error: any) => toast({ title: t("error"), description: error.message, variant: "destructive" }),
  });
  const numberField = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm(current => ({ ...current, [key]: event.target.value }));
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <Label htmlFor="loyalty-enabled">{t("loyalty_program")}</Label>
          <p className="text-sm text-muted-foreground mt-1">{t("loyalty_program_desc")}</p>
        </div>
        <Switch
          id="loyalty-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          data-testid="switch-loyalty-program"
        />
      </div>
      <div className={`grid sm:grid-cols-2 gap-4 ${enabled ? "" : "opacity-50 pointer-events-none"}`}>
        <div className="space-y-2">
          <Label htmlFor="loyalty-points-order">{t("loyalty_points_per_order")}</Label>
          <Input id="loyalty-points-order" type="number" min="0" value={form.pointsPerOrder} onChange={numberField("pointsPerOrder")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loyalty-points-spend">{t("loyalty_points_per_fcfa")}</Label>
          <Input id="loyalty-points-spend" type="number" min="0" step="0.0001" value={form.pointsPerFcfa} onChange={numberField("pointsPerFcfa")} placeholder="0.0100" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loyalty-renewal">{t("loyalty_renewal_bonus")}</Label>
          <Input id="loyalty-renewal" type="number" min="0" value={form.renewalBonus} onChange={numberField("renewalBonus")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loyalty-referral">{t("loyalty_referral_bonus")}</Label>
          <Input id="loyalty-referral" type="number" min="0" value={form.referralBonus} onChange={numberField("referralBonus")} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="loyalty-expiry">{t("loyalty_expiry_days")}</Label>
          <Input id="loyalty-expiry" type="number" min="1" value={form.pointExpireDays} onChange={numberField("pointExpireDays")} placeholder={t("loyalty_never_expires")} />
        </div>
      </div>
      <Button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        data-testid="button-save-loyalty"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMut.isPending ? t("saving") : t("save_changes")}
      </Button>
    </div>
  );
}

// ─── Team & Sites Tab ─────────────────────────────────────────────────────────

function TeamTab() {
  const { t, i18n } = useTranslation();
  const { user, isOwner, userRole } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newSiteOpen, setNewSiteOpen] = useState(false);
  const [editSite, setEditSite] = useState<any | null>(null);
  const [inviteForm, setInviteForm] = useState({ siteId: "", identifier: "", role: "operator" });
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const { data: sites = [] } = useQuery<any[]>({
    queryKey: ["/api/sites"],
  });

  const { data: pending = [] } = useQuery<any[]>({
    queryKey: ["/api/invitations/pending"],
    enabled: isOwner,
  });

  const { data: membersMap } = useQuery({
    queryKey: ["/api/sites", sites.map((s: any) => s.id)],
    queryFn: async () => {
      const map: Record<number, any[]> = {};
      await Promise.all(sites.map(async (s: any) => {
        const res = await fetch(`/api/sites/${s.id}/members`, { credentials: "include" });
        if (res.ok) map[s.id] = await res.json();
      }));
      return map;
    },
    enabled: sites.length > 0,
  });

  const createSiteMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sites"] });
      setNewSiteOpen(false);
      setNewSiteName("");
      setNewSiteAddress("");
      setNewSiteCity("");
      toast({ title: t("site_created") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteSiteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: t("site_removed") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateSiteMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const payload = {
        name: data.name,
        address: data.address || "",
        city: data.city || "",
        phone: data.phone || "",
      };
      const res = await fetch(`/api/sites/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(async () => ({ message: await res.text() }));
        throw new Error(error.message || t("failed_update_site"));
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sites"] });
      setEditSite(null);
      toast({ title: t("site_updated") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const removeMemberMut = useMutation({
    mutationFn: async ({ siteId, userId }: { siteId: number; userId: string }) => {
      const res = await fetch(`/api/sites/${siteId}/members/${userId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: t("member_removed") });
    },
  });

  const changeRoleMut = useMutation({
    mutationFn: async ({ siteId, userId, role }: { siteId: number; userId: string; role: string }) => {
      const res = await fetch(`/api/sites/${siteId}/members/${userId}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: t("role_updated") });
    },
  });

  const inviteMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/invitations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/invitations/pending"] });
      setInviteOpen(false);
      if (data.invitationLink) {
        navigator.clipboard.writeText(data.invitationLink);
        toast({ title: t("invitation_created"), description: t("share_invitation_link") });
      }
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const revokeInviteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/invitations/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invitations/pending"] });
      toast({ title: t("invitation_revoked") });
    },
  });

  const copyInviteLink = useCallback(async (token: string) => {
    const link = `${window.location.origin}/join/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(token);
    setTimeout(() => setCopiedLink(null), 2000);
  }, []);

  const ROLE_COLORS: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    operator: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };

  if (!isOwner) {
    return (
      <div className="max-w-xl">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("team_owner_only")}</p>
            <Badge className={`mt-3 ${ROLE_COLORS[userRole]}`}>{userRole}</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Sites */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t("sites")}</h3>
        <Button size="sm" onClick={() => setNewSiteOpen(true)} data-testid="button-add-site">
          <Plus className="w-4 h-4 mr-2" />
          {t("add_site")}
        </Button>
      </div>

      <div className="space-y-4">
        {sites.map((site: any) => {
          const members: any[] = membersMap?.[site.id] || [];
          return (
            <Card key={site.id} data-testid={`card-site-${site.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{site.name}</CardTitle>
                    {(site.city || site.address) && (
                      <CardDescription className="text-xs">{[site.address, site.city].filter(Boolean).join(", ")}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{t("members_count", { count: site.memberCount || members.length })}</Badge>
                    {isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-site-menu-${site.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditSite(site)}>{t("edit_site")}</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(t("remove_site_confirm", { name: site.name }))) deleteSiteMut.mutate(site.id);
                            }}
                          >
                            {t("delete_site")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              {members.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {members.map((m: any) => (
                      <div key={m.userId} className="flex items-center justify-between py-1.5" data-testid={`row-member-${m.userId}`}>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-7 h-7">
                            <AvatarFallback className="text-xs">{(m.name || m.userId)?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{m.name || m.userId}</p>
                            {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={m.role}
                            onValueChange={(role) => changeRoleMut.mutate({ siteId: site.id, userId: m.userId, role })}
                            disabled={m.role === "owner"}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs" data-testid={`select-role-${m.userId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">{t("role_owner")}</SelectItem>
                              <SelectItem value="manager">{t("role_manager")}</SelectItem>
                              <SelectItem value="operator">{t("role_operator")}</SelectItem>
                            </SelectContent>
                          </Select>
                          {m.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => removeMemberMut.mutate({ siteId: site.id, userId: m.userId })}
                              data-testid={`button-remove-member-${m.userId}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => { setInviteForm((f) => ({ ...f, siteId: String(site.id) })); setInviteOpen(true); }} data-testid={`button-invite-to-${site.id}`}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("invite_member")}
                  </Button>
                </CardContent>
              )}
              {members.length === 0 && (
                <CardContent className="pt-0">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { setInviteForm((f) => ({ ...f, siteId: String(site.id) })); setInviteOpen(true); }} data-testid={`button-invite-first-${site.id}`}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("invite_first_member")}
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
        {sites.length === 0 && (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Globe2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("no_sites_create_first")}</p>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {(pending as any[]).length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3">{t("pending_invitations")}</h3>
          <div className="space-y-2">
            {(pending as any[]).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border" data-testid={`row-invite-${inv.id}`}>
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full">
                    <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inv.identifier}</p>
                    <p className="text-xs text-muted-foreground">{inv.siteName} · {t("role_" + inv.role, inv.role)} · {t("expires")} {format(new Date(inv.expiresAt), "MMM dd", { locale: dateLocaleFor(i18n.language) })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyInviteLink(inv.token)}
                    data-testid={`button-copy-invite-${inv.id}`}
                    title={t("copy_invite_link")}
                  >
                    {copiedLink === inv.token ? <span className="text-xs text-green-600">✓</span> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => revokeInviteMut.mutate(inv.id)}
                    data-testid={`button-revoke-invite-${inv.id}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invite_team_member")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("sites")}</Label>
              <Select value={inviteForm.siteId} onValueChange={(v) => setInviteForm((f) => ({ ...f, siteId: v }))}>
                <SelectTrigger data-testid="select-invite-site">
                  <SelectValue placeholder={t("sites")} />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input
                value={inviteForm.identifier}
                onChange={(e) => setInviteForm((f) => ({ ...f, identifier: e.target.value }))}
                placeholder={t("invite_email_placeholder")}
                data-testid="input-invite-identifier"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("employee_role")}</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">{t("role_manager")}</SelectItem>
                  <SelectItem value="operator">{t("role_operator")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("role_access_hint")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => inviteMut.mutate(inviteForm)} disabled={inviteMut.isPending || !inviteForm.siteId || !inviteForm.identifier} data-testid="button-send-invite">
              <LinkIcon className="w-4 h-4 mr-2" />
              {inviteMut.isPending ? t("sending") : t("create_invite_link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newSiteOpen} onOpenChange={setNewSiteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("add_new_site")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("site_name_label")}</Label>
              <Input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} placeholder={t("site_name_placeholder")} data-testid="input-site-name" />
            </div>
            <div className="space-y-2">
              <Label>{t("address")}</Label>
              <Input value={newSiteAddress} onChange={(e) => setNewSiteAddress(e.target.value)} placeholder={t("street_address_placeholder")} data-testid="input-site-address" />
            </div>
            <div className="space-y-2">
              <Label>{t("city")}</Label>
              <Input value={newSiteCity} onChange={(e) => setNewSiteCity(e.target.value)} placeholder="Yaounde" data-testid="input-site-city" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSiteOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createSiteMut.mutate({ name: newSiteName, address: newSiteAddress, city: newSiteCity })} disabled={createSiteMut.isPending || !newSiteName} data-testid="button-create-site">
              {createSiteMut.isPending ? t("creating") : t("create_site")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSite} onOpenChange={() => setEditSite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit_site")}</DialogTitle>
          </DialogHeader>
          {editSite && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("sites")}</Label>
                <Input value={editSite.name} onChange={(e) => setEditSite((s: any) => ({ ...s, name: e.target.value }))} data-testid="input-edit-site-name" />
              </div>
              <div className="space-y-2">
                <Label>{t("address")}</Label>
                <Input value={editSite.address || ""} onChange={(e) => setEditSite((s: any) => ({ ...s, address: e.target.value }))} data-testid="input-edit-site-address" />
              </div>
              <div className="space-y-2">
                <Label>{t("city")}</Label>
                <Input value={editSite.city || ""} onChange={(e) => setEditSite((s: any) => ({ ...s, city: e.target.value }))} data-testid="input-edit-site-city" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSite(null)}>{t("cancel")}</Button>
            <Button onClick={() => updateSiteMut.mutate({ id: editSite.id, data: editSite })} disabled={updateSiteMut.isPending} data-testid="button-save-site-edit">
              {updateSiteMut.isPending ? t("saving") : t("save_changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function Settings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isOwner, hasCapability } = useAuth();
  const canManageStainTreatment = hasCapability("manage_stain_treatment_pricing");

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/settings"],
    enabled: isOwner,
  });

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: t("settings_saved") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  if (isOwner && isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!isOwner && !canManageStainTreatment) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold mb-2">{t("access_denied")}</h2>
            <p className="text-sm text-muted-foreground">{t("settings_owner_only")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">{t("settings")}</h1>
        <p className="text-muted-foreground mt-1">{t("settings_subtitle")}</p>
      </div>

      <Tabs defaultValue={isOwner ? "identity" : "stain-treatment"}>
        <TabsList className={`grid w-full max-w-3xl ${isOwner ? "grid-cols-6" : "grid-cols-1"}`} data-testid="settings-tabs">
          {isOwner && <>
          <TabsTrigger value="identity" className="gap-2" data-testid="tab-identity">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t("business")}</span>
          </TabsTrigger>
          <TabsTrigger value="receipt" className="gap-2" data-testid="tab-receipt">
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">{t("receipt")}</span>
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-2" data-testid="tab-terms">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">{t("terms")}</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2" data-testid="tab-team">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">{t("team")}</span>
          </TabsTrigger>
          <TabsTrigger value="loyalty" className="gap-2" data-testid="tab-loyalty">
            <Gift className="w-4 h-4" />
            <span className="hidden sm:inline">{t("loyalty")}</span>
          </TabsTrigger>
          </>}
          {canManageStainTreatment && <TabsTrigger value="stain-treatment" className="gap-2" data-testid="tab-stain-treatment">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("stain_treatment")}</span>
          </TabsTrigger>}
        </TabsList>

        <div className="mt-6">
          {isOwner && <><TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle>{t("business_identity")}</CardTitle>
                <CardDescription>{t("business_identity_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <BusinessIdentityTab settings={merged} onSave={(d) => saveMut.mutate(d)} saving={saveMut.isPending} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipt">
            <Card>
              <CardHeader>
                <CardTitle>{t("receipt_layout")}</CardTitle>
                <CardDescription>{t("receipt_layout_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ReceiptLayoutTab settings={merged} onSave={(d) => saveMut.mutate(d)} saving={saveMut.isPending} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms">
            <Card>
              <CardHeader>
                <CardTitle>{t("terms_conditions")}</CardTitle>
                <CardDescription>{t("terms_conditions_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <TermsTab settings={merged} onSave={(d) => saveMut.mutate(d)} saving={saveMut.isPending} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>{t("team_sites")}</CardTitle>
                <CardDescription>{t("team_sites_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <TeamTab />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="loyalty">
            <Card>
              <CardHeader>
                <CardTitle>{t("loyalty_program")}</CardTitle>
                <CardDescription>{t("loyalty_program_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <LoyaltyTab settings={merged} />
              </CardContent>
            </Card>
          </TabsContent>
          </>}
          {canManageStainTreatment && <TabsContent value="stain-treatment">
            <StainTreatmentSettings canManage={canManageStainTreatment} />
          </TabsContent>}
        </div>
      </Tabs>
    </div>
  );
}
