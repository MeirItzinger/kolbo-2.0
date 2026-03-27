# Kolbo — Multi-Channel Streaming Platform

Kolbo is a production-grade multi-channel streaming/content platform supporting channels, creators, subscriptions, bundles, rentals, purchases, free and ad-supported content, multiple concurrency tiers, and full admin portals.

## Architecture

```
kolbo 2.0/
├── apps/
│   ├── api/                    # Express + TypeScript backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Full database schema
│   │   │   ├── seed.ts         # Database seed script
│   │   │   └── migrations/     # Prisma migrations
│   │   └── src/
│   │       ├── config/         # Environment configuration
│   │       ├── controllers/    # Route handlers (thin layer)
│   │       ├── routes/         # Express route definitions
│   │       ├── middleware/     # Auth, RBAC, validation, error handling
│   │       ├── services/       # Business logic
│   │       │   ├── auth/       # Authentication service
│   │       │   ├── stripe/     # Stripe billing + webhooks
│   │       │   ├── mux/        # Mux video + webhooks
│   │       │   └── access/     # Entitlement/access control
│   │       ├── lib/            # Client singletons (Prisma, Stripe, Mux, Email, JWT)
│   │       └── utils/          # ApiError, asyncHandler
│   │
│   └── web/                    # React + TypeScript frontend
│       └── src/
│           ├── api/            # API client modules
│           ├── components/     # UI components (shadcn-style)
│           ├── features/       # Feature components (player, signup, content)
│           ├── hooks/          # Auth hook/context
│           ├── layouts/        # Route layouts
│           ├── lib/            # Utils, query client
│           ├── pages/          # All page components
│           │   ├── admin/      # Super admin portal
│           │   ├── channel-admin/
│           │   ├── creator-admin/
│           │   ├── account/    # User account management (via app/)
│           │   ├── auth/       # Login, signup, password flows
│           │   ├── signup/     # Multi-step signup
│           │   └── app/        # Authenticated user pages
│           └── types/          # TypeScript type definitions
│
└── packages/
    └── types/                  # Shared types (extensible)
```

## Tech Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| Frontend     | React 19, TypeScript, Vite, Tailwind CSS v4        |
| UI           | shadcn/ui patterns, Radix UI, Lucide icons         |
| Data         | TanStack Query, React Hook Form, Zod               |
| Backend      | Node.js, Express, TypeScript                       |
| ORM          | Prisma                                             |
| Database     | PostgreSQL on Neon.tech                             |
| Payments     | Stripe (Checkout, Subscriptions, Webhooks)          |
| Video        | Mux (Direct Upload, Signed Playback, Webhooks)      |
| Auth         | JWT (access + refresh tokens), bcrypt               |
| Email        | Resend                                             |

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **PostgreSQL** database (recommended: [Neon.tech](https://neon.tech))
- **Stripe** account with API keys
- **Mux** account with API keys and a signing key
- **Resend** account for transactional emails

## Getting Started

### 1. Clone and install

```bash
cd "kolbo 2.0"
npm install
```

This installs dependencies for both `apps/api` and `apps/web` via npm workspaces.

### 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Fill in all values in both `.env` files. See the [Environment Variables](#environment-variables) section below.

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (for initial development)
npm run db:push

# Or run migrations (for production)
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### 4. Run the development servers

In separate terminals:

```bash
# Backend (port 4000)
npm run dev:api

# Frontend (port 5173)
npm run dev:web
```

The frontend proxies `/api` requests to `localhost:4000` in development.

### 5. Access the app

- **Frontend**: http://localhost:5173
- **API**: http://localhost:4000
- **Health check**: http://localhost:4000/health
- **Prisma Studio**: `npm run db:studio`

### Default admin credentials

After seeding:
- **Email**: admin@kolbo.tv
- **Password**: Admin123!

## Environment Variables

### Backend (`apps/api/.env`)

| Variable                  | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `PORT`                    | Server port (default: 4000)                    |
| `NODE_ENV`                | development / production / test                |
| `CLIENT_URL`              | Frontend URL for CORS and email links          |
| `DATABASE_URL`            | Neon PostgreSQL connection string (pooled)      |
| `DIRECT_URL`              | Neon PostgreSQL direct connection string        |
| `JWT_ACCESS_SECRET`       | Secret for signing access tokens               |
| `JWT_REFRESH_SECRET`      | Secret for signing refresh tokens              |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token TTL (e.g., `15m`)                 |
| `REFRESH_TOKEN_EXPIRES_IN`| Refresh token TTL (e.g., `7d`)                 |
| `EMAIL_FROM`              | Sender email address                           |
| `RESEND_API_KEY`          | Resend API key                                 |
| `STRIPE_SECRET_KEY`       | Stripe secret key                              |
| `STRIPE_WEBHOOK_SECRET`   | Stripe webhook signing secret                  |
| `STRIPE_PUBLISHABLE_KEY`  | Stripe publishable key                         |
| `MUX_TOKEN_ID`            | Mux API token ID                               |
| `MUX_TOKEN_SECRET`        | Mux API token secret                           |
| `MUX_WEBHOOK_SECRET`      | Mux webhook signing secret                     |
| `MUX_SIGNING_KEY_PRIVATE` | Base64-encoded RSA private key for Mux playback |
| `MUX_SIGNING_KEY_ID`      | Mux signing key ID                             |
| `USCREEN_API_BASE_URL`    | Uscreen API base URL for fallback auth check   |
| `USCREEN_ME_PATH`         | Uscreen endpoint used to validate access token |

### Frontend (`apps/web/.env`)

| Variable                       | Description                    |
| ------------------------------ | ------------------------------ |
| `VITE_API_URL`                 | Backend API URL                |
| `VITE_STRIPE_PUBLISHABLE_KEY`  | Stripe publishable key         |

## Stripe Webhook Forwarding (Local Development)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Copy the webhook signing secret output and set it as `STRIPE_WEBHOOK_SECRET`.

Events handled:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

## Mux Webhook Testing (Local Development)

Use [ngrok](https://ngrok.com) or a similar tunnel:

```bash
ngrok http 4000
```

Set your Mux webhook URL to `https://<ngrok-id>.ngrok.io/api/webhooks/mux` in the Mux dashboard.

Events handled:
- `video.asset.created`
- `video.asset.ready`
- `video.asset.errored`
- `video.upload.asset_created`

## Key Features

### Content Access Model

Kolbo supports multiple gated access formats per video:
- **Free** — no login required
- **Free with Ads** — no payment, ads play
- **Subscription** — channel-level monthly/yearly plans
- **Bundle** — multi-channel subscription bundles
- **Rental** — time-limited access (e.g., 48 hours)
- **Purchase** — permanent ownership

### Subscription Tiers

Each subscription plan has:
- **Concurrency tier**: 1, 3, or 5 simultaneous streams
- **Ad tier**: full price (no ads) or cheaper (with ads)
- **Billing interval**: monthly or yearly

### Admin Portals

| Portal         | Access              | Capabilities                                      |
| -------------- | ------------------- | ------------------------------------------------- |
| Super Admin    | `/admin`            | Full platform management                          |
| Channel Admin  | `/channel-admin/:id`| Manage assigned channel content and creators      |
| Creator Admin  | `/creator-admin/:id`| Manage own videos within allowed channels         |

### RBAC

Roles: `SUPER_ADMIN`, `CHANNEL_ADMIN`, `CREATOR_ADMIN`, `USER`

- Backend enforces role checks on every protected endpoint
- Channel/creator admin roles are scoped to specific channel/creator IDs
- Super admin bypasses all scope checks

### Payout System

- Platform (Kolbo) vs. channel revenue splits
- Creator payout rules: per-minute-watched, percentage of subscription/rental/purchase/ad revenue
- Payout ledger tracking with status lifecycle (PENDING → POSTED → PAID)

## API Endpoints

### Auth
| Method | Path                          | Auth     |
| ------ | ----------------------------- | -------- |
| POST   | `/api/auth/signup`            | Public   |
| POST   | `/api/auth/login`             | Public   |
| POST   | `/api/auth/logout`            | Auth     |
| POST   | `/api/auth/refresh`           | Public   |
| POST   | `/api/auth/verify-email`      | Public   |
| POST   | `/api/auth/resend-verification`| Public  |
| POST   | `/api/auth/forgot-password`   | Public   |
| POST   | `/api/auth/reset-password`    | Public   |
| GET    | `/api/auth/me`                | Auth     |

### Content
| Method | Path                          | Auth           |
| ------ | ----------------------------- | -------------- |
| GET    | `/api/channels`               | Public         |
| GET    | `/api/channels/:idOrSlug`     | Public         |
| POST   | `/api/channels`               | Super Admin    |
| PATCH  | `/api/channels/:id`           | Admin          |
| GET    | `/api/videos`                 | Public         |
| GET    | `/api/videos/:idOrSlug`       | Public         |
| POST   | `/api/videos`                 | Admin          |
| PATCH  | `/api/videos/:id`             | Admin          |
| POST   | `/api/videos/:id/publish`     | Admin          |

### Commerce
| Method | Path                                    | Auth   |
| ------ | --------------------------------------- | ------ |
| GET    | `/api/subscription-plans`               | Public |
| GET    | `/api/bundles`                          | Public |
| POST   | `/api/stripe/checkout/subscription`     | Auth   |
| POST   | `/api/stripe/checkout/bundle`           | Auth   |
| POST   | `/api/stripe/checkout/rental`           | Auth   |
| POST   | `/api/stripe/checkout/purchase`         | Auth   |
| POST   | `/api/discount-codes/validate`          | Auth   |

### Playback
| Method | Path                              | Auth   |
| ------ | --------------------------------- | ------ |
| GET    | `/api/playback/token/:videoId`    | Optional |
| POST   | `/api/watch-sessions/heartbeat`   | Auth   |
| POST   | `/api/watch-sessions/end`         | Auth   |

`/api/playback/token/:videoId` and `/api/videos/:idOrSlug` accept optional Uscreen token headers for fallback entitlement:
- `X-Uscreen-Access-Token: <token>` (preferred)

### Account
| Method | Path                                    | Auth   |
| ------ | --------------------------------------- | ------ |
| GET    | `/api/account/subscriptions`            | Auth   |
| POST   | `/api/account/subscriptions/:id/cancel` | Auth   |
| GET    | `/api/account/purchases`                | Auth   |
| GET    | `/api/account/rentals`                  | Auth   |
| GET    | `/api/account/payment-methods`          | Auth   |
| GET    | `/api/account/devices`                  | Auth   |
| GET    | `/api/account/watch-history`            | Auth   |

## Database Schema

The Prisma schema defines 35+ models covering:
- Auth/Users (User, Role, UserRole, Session, tokens, Profile, Device)
- Organizations (Channel, CreatorProfile, ChannelCreator, ChannelAdmin)
- Payouts (PayoutRule, CreatorPayoutRule, PayoutLedger)
- Content (Video, VideoAsset, ThumbnailAsset, VideoTag, ContentRow, LandingHero)
- Commerce (SubscriptionPlan, Bundle, RentalOption, PurchaseOption, VideoAccessRule, DiscountCode)
- Entitlements (UserSubscription, UserBundleSubscription, UserRental, UserPurchase, PaymentMethod, InvoiceLog)
- Watching (WatchSession, StreamConcurrencyLimit, WatchHistory, Favorite)

View the full schema: `apps/api/prisma/schema.prisma`

## Next Steps / Roadmap

- [ ] Stripe product/price sync script (create Stripe products for plans)
- [ ] Live streaming support (architecture is live-ready)
- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] Content recommendations engine
- [ ] Mobile apps (React Native)
- [ ] CDN integration for thumbnails/images
- [ ] Full-text search (consider Meilisearch or Algolia)
- [ ] Rate limiting middleware
- [ ] Automated testing suite
- [ ] CI/CD pipeline
- [ ] Docker containerization
- [ ] Kubernetes deployment configuration

## License

Private — All rights reserved.
