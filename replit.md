# Replit MD

## Overview

CleanEase is a full-stack laundry business management application. It allows laundry shop operators to manage customers, services (wash & fold, dry cleaning, ironing), orders with line items, payments, expenditures, machines, employees, and view dashboard statistics with analytics. The app features email/password authentication, internationalization (English/French), multi-currency support (USD, Naira, FCFA, Euro), subscription-based plan gating, Pan-African payment methods (17 options including mobile money), a 7-stage order pipeline with garment return tracking, and a clean blue-themed UI designed around the laundry business domain.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state (caching, fetching, mutations)
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Forms**: React Hook Form with Zod resolvers for validation
- **Internationalization**: i18next with react-i18next, supports English and French
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support), custom fonts (DM Sans, Outfit)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express.js running on Node with TypeScript (via tsx)
- **HTTP Server**: Node's `http.createServer` wrapping Express
- **API Pattern**: RESTful JSON API under `/api/*` prefix
- **Authentication**: Replit OpenID Connect (OIDC) integration via Passport.js with session-based auth stored in PostgreSQL
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Validation**: Zod schemas shared between client and server (via `shared/` directory)
- **Development**: Vite dev server with HMR proxied through Express middleware
- **Production Build**: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`

### Shared Code (`shared/` directory)
- **`schema.ts`**: Drizzle table definitions for customers, services, orders, order_items, payments, expenditures, machines, employees, plans, subscriptions, subscriptionPayments. Also re-exports auth models.
- **`models/auth.ts`**: Sessions and users tables required by Replit Auth (do not modify or drop these)
- **`routes.ts`**: API route definitions with Zod response schemas, used by both client hooks and server routes for type safety

### Database Schema (PostgreSQL via Drizzle)
- **customers**: id, name, phone, email, address, notes, starchLevel, detergentType, createdAt
- **services**: id, name, description, unit (kg/piece), price (decimal), category, imageUrl, active, minimumCharge (decimal), estimatedDuration (int), durationUnit (hours/days), expressAvailable (bool), expressSurcharge (decimal %)
- **orders**: id, customerId (FK→customers), status (pending/processing/ready/delivered/cancelled), totalAmount (decimal), paymentStatus (unpaid/paid/partial), createdAt, updatedAt
- **order_items**: id, orderId (FK→orders), serviceId (FK→services), quantity, priceAtOrder (decimal)
- **payments**: Payment records linked to orders
- **expenditures**: Business expense tracking with amount, category, description, date
- **machines**: id, userId (varchar), name, type (washer/dryer/press/other), capacityKg, status (active/maintenance/inactive), utilizationRate, cycleCount, totalKgProcessed, createdAt
- **employees**: id, userId (varchar), name, role, phone, email, salary, kgProcessed, ordersHandled, active, createdAt
- **plans**: id, name, slug, price, maxOrders, maxUsers, features (jsonb array), active, createdAt
- **subscriptions**: id, userId (varchar), planId (FK→plans), status (active/cancelled/expired), startDate, endDate, ordersUsed, createdAt
- **subscription_payments**: id, subscriptionId (FK→subscriptions), amount, method, status, paidAt
- **users**: Replit Auth user records (id, email, firstName, lastName, profileImageUrl)
- **sessions**: Express session store for Replit Auth

Use `npm run db:push` to push schema changes to the database.

### Authentication
- Email/password authentication with bcryptjs password hashing
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Protected routes on frontend redirect unauthenticated users to auth page
- Auth routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/user`
- `/api/auth/user` returns user data plus `planSlug` from active subscription
- Users table includes: id (varchar UUID), email, passwordHash, firstName, lastName, phone, businessName, role
- **Important**: Do not modify or drop the `users` and `sessions` tables

### Order Pipeline (7 stages)
- Stages: received → washing → stain_treatment → drying → ironing → ready → delivered
- `orderStatusHistory` table tracks all status transitions with timestamps
- Status changes recorded via `PATCH /api/orders/:id` with `changedBy` user ID
- Order detail page (`/orders/:id`) shows visual pipeline stepper

### Garment Return System
- `garmentItems` table has `returnedForTreatment`, `returnStage`, `returnNotes`, `resolvedAt` fields
- `PATCH /api/garment-items/:id/return` flags a garment for re-treatment
- `PATCH /api/garment-items/:id/resolve` marks return as resolved
- Dashboard alerts show orders with unresolved garment returns
- Order list shows warning icon for orders with returned items

### Deposit Receipt
- Auto-downloads HTML receipt on order creation
- Available from order detail page via Download Receipt button
- Shows pipeline tracker, service summary, garment checklist, payment records, T&Cs

### Pan-African Payment Methods
- 17 payment methods grouped by region: Universal, Central/West/East/Southern Africa, Nigeria, Pan-African, International
- Methods include MTN Mobile Money, Orange Money, M-Pesa, Wave, OPay, Flutterwave, Paystack, etc.
- Reference field for transaction IDs (conditionally shown based on method)
- Defined in `client/src/lib/payment-methods.ts`

### Subscription & Plan Gating
- 4 plans seeded on startup: Starter, Pro, Business, Enterprise
- `useAuth()` hook exposes `planSlug` and `hasFeature(feature)` for frontend gating
- Feature map: analytics/machines/employees/reports require Pro+; waste/performance require Business+; api requires Enterprise
- `<UpgradePrompt>` component shown when user lacks required plan
- Subscription payment via `POST /api/subscriptions/pay` with simulate mode for demo

### Key Design Decisions
1. **Shared schemas**: Zod + Drizzle schemas in `shared/` provide end-to-end type safety between client and server
2. **Database seeding**: Automatic seeding on first run when services table is empty (in `server/routes.ts`). Plans seeded via `seedPlans()`.
3. **Custom hooks per entity**: Each domain entity (customers, orders, services, expenditures, stats) has its own React Query hook file in `client/src/hooks/`
4. **Layout shell pattern**: Authenticated pages wrapped in `LayoutShell` component providing sidebar navigation with 11 nav items
5. **Customer Detail View**: `/customers/:id` page with VIP badge, summary cards, tabbed content (Contact/Preferences/Order History), and action buttons (New Order/Edit Profile/WhatsApp/Call). Customer cards on list page are clickable and navigate to detail view.
6. **Reports & Analytics**: `/reports` page with date range filtering, 4 metric highlight cards (revenue, expenses, net profit, orders), daily revenue line chart, service distribution donut chart, top customers table, and downloadable monthly report. Backend endpoint: `GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD`.
7. **Performance Monitor**: Section within Reports page featuring profitability status badge (profitable/loss-making), current month net profit display, smart trend notifications comparing last 30 days vs previous 30 days (spending increases, revenue decreases, profit growth alerts), and 6-month Income vs Expenses bar chart. Backend endpoint: `GET /api/reports/performance`.
8. **Dashboard (upgraded)**: Alerts banner, daily target progress bar, AreaChart (30-day revenue), PieChart (orders by status), BarChart (kg processed). Backend: `GET /api/analytics/dashboard`.
9. **Expenses (upgraded)**: Type breakdown grid, filter pills by category, edit button per row, date filter dropdown. Backend: `PATCH /api/expenditures/:id`.
10. **Machines page**: Card grid with CRUD, utilization bars, capacity display. Backend: CRUD at `/api/machines`.
11. **Employees page**: List cards with CRUD, avatar circles, salary/kg/orders stats. Backend: CRUD at `/api/employees`.
12. **Analytics page**: KPI grid with period selector, break-even bar, waste detection alerts (Business+), performance score with grades (Business+). Backend: `/api/analytics/kpis`, `/api/analytics/waste`, `/api/analytics/performance-score`.
13. **Subscriptions page**: 4 plan cards with features, payment dialog with simulate mode. Backend: `/api/plans`, `/api/subscriptions/current`, `/api/subscriptions/pay`.

## External Dependencies

### Database
- **PostgreSQL**: Required. Connection via `DATABASE_URL` environment variable. Used for all application data and session storage.

### Authentication
- **Replit Auth (OIDC)**: OpenID Connect provider at `https://replit.com/oidc`. Requires `REPL_ID`, `ISSUER_URL`, and `SESSION_SECRET` environment variables.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit**: ORM and migration tooling for PostgreSQL
- **express** + **express-session**: HTTP server and session management
- **passport** + **openid-client**: Authentication via Replit OIDC
- **connect-pg-simple**: PostgreSQL-backed session store
- **@tanstack/react-query**: Server state management on frontend
- **react-hook-form** + **@hookform/resolvers**: Form handling with Zod validation
- **wouter**: Client-side routing
- **i18next** + **react-i18next** + **i18next-browser-languagedetector**: Internationalization
- **recharts**: Dashboard charts (AreaChart, PieChart, BarChart)
- **date-fns**: Date formatting
- **shadcn/ui** components (Radix UI + Tailwind CSS)
