# Replit MD

## Overview

CleanEase is a full-stack laundry business management application. It allows laundry shop operators to manage customers, services (wash & fold, dry cleaning, ironing), orders with line items, payments, expenditures, and view dashboard statistics. The app features Replit Auth for authentication, internationalization (English/French), and a clean blue-themed UI designed around the laundry business domain.

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
- **`schema.ts`**: Drizzle table definitions for customers, services, orders, order_items, payments, expenditures. Also re-exports auth models.
- **`models/auth.ts`**: Sessions and users tables required by Replit Auth (do not modify or drop these)
- **`routes.ts`**: API route definitions with Zod response schemas, used by both client hooks and server routes for type safety

### Database Schema (PostgreSQL via Drizzle)
- **customers**: id, name, phone, email, address, notes, starchLevel, detergentType, createdAt
- **services**: id, name, description, unit (kg/piece), price (decimal), category, imageUrl, active, minimumCharge (decimal), estimatedDuration (int), durationUnit (hours/days), expressAvailable (bool), expressSurcharge (decimal %)
- **orders**: id, customerId (FK→customers), status (pending/processing/ready/delivered/cancelled), totalAmount (decimal), paymentStatus (unpaid/paid/partial), createdAt, updatedAt
- **order_items**: id, orderId (FK→orders), serviceId (FK→services), quantity, priceAtOrder (decimal)
- **payments**: Payment records linked to orders
- **expenditures**: Business expense tracking with amount, category, description
- **users**: Replit Auth user records (id, email, firstName, lastName, profileImageUrl)
- **sessions**: Express session store for Replit Auth

Use `npm run db:push` to push schema changes to the database.

### Authentication
- Replit Auth via OpenID Connect, handled in `server/replit_integrations/auth/`
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Protected routes on frontend redirect unauthenticated users to auth page
- Auth routes: `/api/login`, `/api/logout`, `/api/auth/user`
- **Important**: Do not modify or drop the `users` and `sessions` tables — they are required for Replit Auth

### Key Design Decisions
1. **Shared schemas**: Zod + Drizzle schemas in `shared/` provide end-to-end type safety between client and server
2. **Database seeding**: Automatic seeding on first run when services table is empty (in `server/routes.ts`)
3. **Custom hooks per entity**: Each domain entity (customers, orders, services, expenditures, stats) has its own React Query hook file in `client/src/hooks/`
4. **Layout shell pattern**: Authenticated pages wrapped in `LayoutShell` component providing sidebar navigation
5. **Customer Detail View**: `/customers/:id` page with VIP badge, summary cards, tabbed content (Contact/Preferences/Order History), and action buttons (New Order/Edit Profile/WhatsApp/Call). Customer cards on list page are clickable and navigate to detail view.
6. **Reports & Analytics**: `/reports` page with date range filtering, 4 metric highlight cards (revenue, expenses, net profit, orders), daily revenue line chart, service distribution donut chart, top customers table, and downloadable monthly report. Backend endpoint: `GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD`.

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
- **recharts**: Dashboard charts
- **date-fns**: Date formatting
- **shadcn/ui** components (Radix UI + Tailwind CSS)