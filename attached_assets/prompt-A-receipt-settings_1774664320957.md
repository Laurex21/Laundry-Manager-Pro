# Replit AI Agent — Prompt A: Business Profile & Receipt Customization

## Context & Stack

This is a full-stack laundry management SaaS app (CleanEase / BlanchisseriePro).

- **Frontend**: React + TypeScript, Wouter routing, TanStack Query, shadcn/ui, Tailwind CSS, i18next (EN/FR)
- **Backend**: Express 5 + TypeScript, JWT auth (Bearer token in Authorization header, stored in localStorage as "token"), Drizzle ORM, PostgreSQL
- **Monorepo structure**: `artifacts/api-server/` (backend), `artifacts/laundry-saas/src/` (frontend), `lib/db/` (Drizzle schema)
- **Auth**: JWT — `apiFetch` helper in `src/lib/api.ts` attaches the Bearer token automatically
- **Receipt system**: `generateReceiptHTML()` in `src/pages/payments.tsx` and `generateDepositReceiptHTML()` in `src/pages/orders.tsx` — both currently use HARDCODED strings for business name ("BlanchisseriePro"), address ("Dakar, Sénégal"), phone ("+221 77 000 00 00"), email ("contact@blanchisserie.pro"), and terms (6 hardcoded French bullet points)

## Goal

Create a **Business Profile & Receipt Settings** system that:
1. Stores all business identity and receipt configuration in the database
2. Serves it via a dedicated API endpoint
3. Lets the owner edit everything from a `/settings` page in the app
4. Automatically uses those settings in ALL receipt generation functions — replacing every hardcoded string

---

## PART 1 — Database Schema

### New table: `business_settings`

Add this table to the Drizzle schema in `lib/db/schema.ts` (or wherever the schema lives):

```ts
export const businessSettings = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  // Business Identity
  businessName: varchar("business_name", { length: 255 }).notNull().default("My Laundry"),
  tagline: varchar("tagline", { length: 255 }).default(""),
  logoBase64: text("logo_base64"),           // base64-encoded image, nullable
  address: varchar("address", { length: 500 }).default(""),
  city: varchar("city", { length: 100 }).default(""),
  country: varchar("country", { length: 100 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  phone2: varchar("phone2", { length: 50 }).default(""),  // second phone, optional
  email: varchar("email", { length: 255 }).default(""),
  website: varchar("website", { length: 255 }).default(""),
  // Receipt Appearance
  receiptHeaderColor: varchar("receipt_header_color", { length: 7 }).notNull().default("#1e3a5f"),
  receiptLanguage: varchar("receipt_language", { length: 5 }).notNull().default("fr"),  // "fr", "en", "both"
  showLogo: boolean("show_logo").notNull().default(true),
  showPickupDate: boolean("show_pickup_date").notNull().default(true),
  showGarmentList: boolean("show_garment_list").notNull().default(true),
  showPaymentHistory: boolean("show_payment_history").notNull().default(true),
  showTerms: boolean("show_terms").notNull().default(true),
  // Terms of Service — stored as plain text, one clause per line separated by \n
  termsOfService: text("terms_of_service"),  // null = use default terms
  // Footer note
  receiptFooterNote: varchar("receipt_footer_note", { length: 500 }).default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

Run `pnpm --filter @workspace/db run push` after adding the schema.

---

## PART 2 — Backend API Routes

Add these routes to the Express API server. All routes require JWT authentication.

### GET `/api/settings`
- Check `req.user.id` (from JWT middleware)
- Query `business_settings` WHERE `userId = req.user.id`
- If no row exists yet, return a default settings object (all default values, businessName = user's business name or "My Laundry"):
```ts
{
  businessName: user.businessName || "My Laundry",
  tagline: "",
  logoBase64: null,
  address: "", city: "", country: "",
  phone: "", phone2: "", email: "", website: "",
  receiptHeaderColor: "#1e3a5f",
  receiptLanguage: "fr",
  showLogo: true, showPickupDate: true,
  showGarmentList: true, showPaymentHistory: true, showTerms: true,
  termsOfService: null,
  receiptFooterNote: ""
}
```
- Return 200 with the settings object

### PUT `/api/settings`
- Body: partial or full settings object (all fields optional)
- Upsert into `business_settings` (INSERT … ON CONFLICT (user_id) DO UPDATE SET …)
- Return 200 with the updated settings object

### POST `/api/settings/logo`
- Body: `multipart/form-data` with a file field named `logo`
- Accept image files only (jpeg, png, webp, gif) — max 2MB
- Convert the uploaded file to base64 string
- Store in `logoBase64` field of business_settings
- Return `{ logoBase64: "data:image/png;base64,..." }`
- If no multipart support is installed, use `multer` package: `pnpm --filter @workspace/api-server add multer @types/multer`

---

## PART 3 — Frontend: Settings Page

Create new file: `artifacts/laundry-saas/src/pages/settings.tsx`

This page has **three tabbed sections** using shadcn Tabs component. Only accessible to users with `role === "owner"` or `role === "admin"` — if another role accesses it, show a "Access restricted to account owners" message.

Fetch settings on mount: `GET /api/settings` via TanStack Query with key `["settings"]`.
Save changes: `PUT /api/settings` mutation. Show a success toast on save.

### Tab 1 — "Business Identity" (icon: Building2)

Fields (all use controlled inputs, pre-filled from fetched settings):

| Field | Input type | Notes |
|---|---|---|
| Business Name | text, required | e.g. "Pressing Excellence" |
| Tagline / Slogan | text, optional | e.g. "Votre linge, notre passion" |
| Logo | file upload | Show current logo preview if exists. Accept image/* max 2MB. Upload via POST /api/settings/logo on file select. Show circular preview 80px. |
| Address | text | Street address |
| City | text | |
| Country | text | e.g. "Cameroun", "Sénégal" |
| Phone (primary) | text | e.g. "+237 6XX XXX XXX" |
| Phone (secondary) | text, optional | |
| Email | email | |
| Website | text, optional | e.g. "www.pressing-excellence.cm" |

"Save Business Info" button at bottom of tab — calls PUT /api/settings.

### Tab 2 — "Receipt Layout" (icon: Receipt)

A preview card on the right side + toggle controls on the left.

**Toggle switches** (using shadcn Switch component):

| Toggle | Label | Default |
|---|---|---|
| showLogo | Show logo on receipt | ON |
| showPickupDate | Show expected pickup date | ON |
| showGarmentList | Show garment item list | ON |
| showPaymentHistory | Show payment history table | ON |
| showTerms | Show terms & conditions | ON |

**Receipt Header Color picker:**
- A row of 6 preset color swatches to pick from:
  - `#1e3a5f` (dark navy — default)
  - `#0f4c3a` (dark green)
  - `#7c2d12` (dark rust/brown)
  - `#1e1b4b` (dark indigo)
  - `#111827` (near-black)
  - `#be185d` (deep pink/rose)
- Plus a native `<input type="color">` for custom color
- Display selected color as a preview rectangle

**Receipt Language select:**
- Options: "Français (FR)", "English (EN)", "Bilingual (FR + EN)"
- Controls the language of labels on the receipt (e.g. "Reçu de Paiement" vs "Payment Receipt")

**Live receipt mini-preview** (right side, desktop only):
- A small scaled-down HTML div showing a receipt preview using the CURRENT settings values
- Updates in real-time as toggles/color change (no API call needed — just re-render the preview component)
- Not interactive, just visual

"Save Receipt Layout" button — calls PUT /api/settings.

### Tab 3 — "Terms & Conditions" (icon: FileText)

**Textarea** for custom terms of service. Large, min 200px height, monospace-ish font.

**"Use Default Template" button** — fills the textarea with this default text (which the user can then edit):
```
Responsabilité : Notre responsabilité pour tout vêtement perdu ou endommagé ne dépassera pas 3 fois le coût de nettoyage de l'article concerné.
Poches : Les clients sont responsables de vider toutes les poches avant le dépôt. Nous ne sommes pas responsables des dommages causés par des objets laissés dans les poches.
Articles non réclamés : Les articles non récupérés dans les 30 jours suivant la date "Prêt" peuvent faire l'objet de frais de stockage. Après 90 jours, ils seront donnés ou jetés.
Dommages préexistants : Nous nous réservons le droit de refuser les articles présentant une usure importante. Nous ne sommes pas responsables des boutons, fermetures ou ornements qui cèdent lors du nettoyage.
Taches : Nous ne pouvons garantir l'élimination à 100% de toutes les taches. Certaines sont permanentes.
Réclamations : Toute réclamation doit être faite dans les 24h après la livraison/retrait, accompagnée du reçu original.
```

**Helper text** below the textarea:
> "Enter one clause per line. Each line will appear as a bullet point on the receipt. Leave empty to hide the terms section."

**Footer Note field** — a single-line text input:
> Label: "Receipt footer note"
> Placeholder: "e.g. Thank you for your trust · Merci de votre confiance"
> This appears at the very bottom of every receipt.

"Save Terms" button — calls PUT /api/settings.

---

## PART 4 — Refactor Receipt Generation Functions

This is the most important part. Both receipt functions must be refactored to accept a `settings` object and use it instead of hardcoded values.

### Create a shared type

Create `artifacts/laundry-saas/src/lib/receipt-settings.ts`:

```ts
export interface ReceiptSettings {
  businessName: string;
  tagline?: string | null;
  logoBase64?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  phone2?: string | null;
  email?: string | null;
  website?: string | null;
  receiptHeaderColor: string;
  receiptLanguage: string;        // "fr" | "en" | "both"
  showLogo: boolean;
  showPickupDate: boolean;
  showGarmentList: boolean;
  showPaymentHistory: boolean;
  showTerms: boolean;
  termsOfService?: string | null;
  receiptFooterNote?: string | null;
}

export const DEFAULT_SETTINGS: ReceiptSettings = {
  businessName: "CleanEase",
  tagline: "Laundry Management",
  logoBase64: null,
  address: "", city: "", country: "",
  phone: "", phone2: "", email: "", website: "",
  receiptHeaderColor: "#1e3a5f",
  receiptLanguage: "fr",
  showLogo: true, showPickupDate: true,
  showGarmentList: true, showPaymentHistory: true, showTerms: true,
  termsOfService: null,
  receiptFooterNote: "Merci de votre confiance · Thank you for your trust",
};

// Hook to fetch settings for use in components
export function useReceiptSettings() {
  // imported from @tanstack/react-query in the component
  // returns { data: ReceiptSettings, isLoading }
}
```

### Create a shared receipt utilities file

Create `artifacts/laundry-saas/src/lib/receipt-utils.ts`:

Move ALL receipt HTML generation logic here. Export two functions:

#### `generateReceiptHTML(order, payment, allPayments, settings)`

Refactor the existing `generateReceiptHTML` from `payments.tsx` to:

1. **Header section** — replace hardcoded values:
   - `BlanchisseriePro` → `settings.businessName`
   - `✦ Blanchisserie Professionnelle` → `settings.tagline || ""`
   - `background: #1e3a5f` → `background: ${settings.receiptHeaderColor}`
   - Contact block: build dynamically from settings fields, only show lines that are non-empty:
     ```ts
     const contactLines = [
       settings.address && settings.city ? `${settings.address}, ${settings.city}` : (settings.city || settings.address),
       settings.country,
       settings.phone,
       settings.phone2,
       settings.email,
       settings.website,
     ].filter(Boolean);
     ```
   - If `settings.showLogo && settings.logoBase64`: add `<img src="${settings.logoBase64}" style="height:50px; margin-bottom:8px; display:block;" />` above the business name

2. **Bilingual labels** — add a helper function inside the file:
   ```ts
   function label(fr: string, en: string, lang: string): string {
     if (lang === "en") return en;
     if (lang === "both") return `${fr} / ${en}`;
     return fr; // default "fr"
   }
   ```
   Use this for all section titles and labels: "Reçu de Paiement" / "Payment Receipt", "Client", "Date de dépôt" / "Drop-off Date", "Détail de la Commande" / "Order Details", etc.

3. **Payment history section** — wrap in `if (settings.showPaymentHistory && allPayments.length > 0)`

4. **Pickup date** — wrap in `if (settings.showPickupDate)`

5. **Terms section** — wrap in `if (settings.showTerms)`:
   - If `settings.termsOfService` is set (not null/empty): split by `\n`, render each line as a `<li>` bullet
   - If `settings.termsOfService` is null/empty: render the 6 default French terms (keep the existing hardcoded ones as fallback)

6. **Footer note** — replace hardcoded `"Merci de votre confiance · BlanchisseriePro · Reçu généré le..."` with:
   ```ts
   `${settings.receiptFooterNote || "Merci de votre confiance"} · ${settings.businessName} · ${label("Reçu généré le", "Generated on", settings.receiptLanguage)} ${new Date().toLocaleDateString("fr-FR")}`
   ```

#### `generateDepositReceiptHTML(order, clientName, garmentItems, settings)`

Same refactoring as above — replace all hardcoded business info with `settings.*` fields.

### Update callers

In `artifacts/laundry-saas/src/pages/payments.tsx`:
1. Remove the local `generateReceiptHTML` function
2. Import it from `@/lib/receipt-utils`
3. Fetch settings using TanStack Query: `const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => apiFetch("/settings") })`
4. Pass settings to `generateReceiptHTML(result.order, result.payment, summaryPayments, settings ?? DEFAULT_SETTINGS)`

In `artifacts/laundry-saas/src/pages/orders.tsx`:
1. Remove the local `generateDepositReceiptHTML` function (if it was added)
2. Import it from `@/lib/receipt-utils`
3. Fetch settings the same way
4. Pass settings to `generateDepositReceiptHTML(newOrder, clientName, garmentItems, settings ?? DEFAULT_SETTINGS)`

---

## PART 5 — Add Settings to Navigation

### In `artifacts/laundry-saas/src/components/layout.tsx` (the sidebar):

Add a Settings nav item at the bottom of the nav list, above the logout button:
```ts
{ href: "/settings", icon: Settings, label: "Settings" }
```
Import `Settings` from `lucide-react`.

Mark it with an `ownerOnly` flag — only show it if `user?.role === "owner"` or `user?.role === "admin"`.

### In `App.tsx`:

Add the route:
```tsx
import SettingsPage from "@/pages/settings";
// ...
<Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
```

---

## PART 6 — i18n Additions

Add these keys to BOTH `en` and `fr` translation objects in `src/lib/i18n.ts` (or wherever i18n is configured):

**English:**
```json
"settings": "Settings",
"business_identity": "Business Identity",
"receipt_layout": "Receipt Layout",
"terms_conditions": "Terms & Conditions",
"business_name": "Business Name",
"tagline": "Tagline / Slogan",
"logo": "Logo",
"upload_logo": "Upload Logo",
"city": "City",
"country": "Country",
"website": "Website",
"secondary_phone": "Secondary Phone",
"receipt_header_color": "Header Color",
"receipt_language": "Receipt Language",
"show_logo_on_receipt": "Show logo on receipt",
"show_pickup_date": "Show pickup date",
"show_garment_list": "Show garment list",
"show_payment_history": "Show payment history",
"show_terms": "Show terms & conditions",
"custom_terms": "Custom Terms of Service",
"use_default_template": "Use Default Template",
"receipt_footer_note": "Receipt Footer Note",
"save_business_info": "Save Business Info",
"save_receipt_layout": "Save Receipt Layout",
"save_terms": "Save Terms",
"settings_saved": "Settings saved successfully",
"live_preview": "Live Preview",
"lang_french": "Français (FR)",
"lang_english": "English (EN)",
"lang_bilingual": "Bilingual (FR + EN)"
```

**French:**
```json
"settings": "Paramètres",
"business_identity": "Identité de l'entreprise",
"receipt_layout": "Mise en page du reçu",
"terms_conditions": "Conditions Générales",
"business_name": "Nom de l'entreprise",
"tagline": "Slogan / Accroche",
"logo": "Logo",
"upload_logo": "Télécharger un logo",
"city": "Ville",
"country": "Pays",
"website": "Site web",
"secondary_phone": "Téléphone secondaire",
"receipt_header_color": "Couleur d'en-tête",
"receipt_language": "Langue du reçu",
"show_logo_on_receipt": "Afficher le logo sur le reçu",
"show_pickup_date": "Afficher la date de retrait",
"show_garment_list": "Afficher la liste des vêtements",
"show_payment_history": "Afficher l'historique des paiements",
"show_terms": "Afficher les conditions générales",
"custom_terms": "Conditions Générales personnalisées",
"use_default_template": "Utiliser le modèle par défaut",
"receipt_footer_note": "Note de bas de reçu",
"save_business_info": "Enregistrer les informations",
"save_receipt_layout": "Enregistrer la mise en page",
"save_terms": "Enregistrer les conditions",
"settings_saved": "Paramètres enregistrés avec succès",
"live_preview": "Aperçu en direct",
"lang_french": "Français (FR)",
"lang_english": "English (EN)",
"lang_bilingual": "Bilingue (FR + EN)"
```

---

## Constraints — DO NOT break

1. Keep the existing `generateReceiptHTML` download behavior (blob → anchor click → `.html` file) — only refactor the HTML content inside it
2. Keep the currency switcher and language switcher in the layout header
3. Keep all existing routes and pages working
4. The settings page must gracefully handle the case where `GET /api/settings` returns defaults (new user with no saved settings) — do not show errors, just show the form pre-filled with defaults
5. Logo upload: if `multer` is not installed, install it. If file upload is complex, as a simpler fallback, convert the file to base64 entirely on the frontend using `FileReader` and send it as a JSON field in the PUT /api/settings body instead of multipart

---

## Verification Checklist

- [ ] `GET /api/settings` returns settings object (defaults if not yet saved)
- [ ] `PUT /api/settings` saves changes and returns updated object
- [ ] `/settings` page loads with 3 tabs
- [ ] Business name, phone, address, email can be edited and saved
- [ ] Logo upload works — preview shows after upload
- [ ] Toggle switches update receipt layout
- [ ] Header color picker changes the receipt header color in live preview
- [ ] Custom terms textarea saves and appears on receipt
- [ ] "Use Default Template" button fills the textarea with default terms
- [ ] Payment receipt (downloaded from Payments page) shows custom business name, not "BlanchisseriePro"
- [ ] Payment receipt shows custom address, phone, email from settings
- [ ] Payment receipt shows custom terms (or default if not set)
- [ ] Deposit receipt (downloaded after order creation) also uses settings
- [ ] Receipts show logo if `showLogo=true` and logo is uploaded
- [ ] Receipt language toggle changes label language on receipt
- [ ] Settings nav item appears in sidebar for owner/admin only
- [ ] No TypeScript errors (`pnpm --filter @workspace/laundry-saas run typecheck`)
