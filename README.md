# Dropify

A production-oriented bilingual dropshipping storefront and admin dashboard built as one Next.js 16 application. It includes English/Arabic routing and RTL, Better Auth, Prisma/PostgreSQL, guest and customer carts, Stripe/Moyasar/PayPal/Paddle/Lemon Squeezy adapters, internal analytics, and the complete catalog/order/review/settings admin surface.

## Local setup

Requirements: Node.js 20.19+, 22.12+, or 24+, plus an already-running local PostgreSQL server. The example database URLs match `compose.yaml`; update both `DATABASE_URL` and `DIRECT_URL` in `.env` if your connection differs.

```powershell
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000` (it redirects to `/en`) or `http://localhost:3000/ar`.

Seeded accounts:

- Admin: `owner@example.com` / `Admin123!`
- Customer: `maya@example.com` / `Demo123!`

The fixed passwords are development seed credentials. Do not run the seed against production; create or rotate the production administrator separately.

## Development behavior

- Verification links, one-time sign-in codes, and order confirmations print to the server console.
- The dummy gateway keys in `.env.example` complete payments locally without external accounts.
- Public catalog pages can show the bundled demo catalog while a development database is temporarily unavailable. Production fails closed instead of exposing demo records.
- Uploaded images are written to `public/uploads`. This is intended for a persistent, single-node deployment; use durable object storage before deploying to an ephemeral or multi-instance host.

## Real payment configuration

Replace the dummy values in `.env` with sandbox or live credentials, then configure these endpoints:

- Stripe webhook: `/api/webhooks/stripe`
- Moyasar invoice callback: `/api/webhooks/moyasar`
- PayPal return/webhook: `/api/webhooks/paypal`
- Paddle webhook: `/api/webhooks/paddle`
- Lemon Squeezy webhook: `/api/webhooks/lemonsqueezy`

Set `PAYPAL_MODE=live`, `PADDLE_ENV=live`, and `LEMONSQUEEZY_TEST_MODE=false` only after completing sandbox/test-mode verification. Paddle also requires the checkout page (`/[locale]/checkout/paddle/...`) to be on an approved domain and configured as an approved/default payment-link page. **Do not enable Paddle or Lemon Squeezy for this store's physical dropshipping catalog:** both providers currently prohibit physical goods. Their adapters are included for sandbox integration work or a future approved digital-goods catalog only, and are production opt-ins through `NEXT_PUBLIC_PADDLE_ENABLED` and `NEXT_PUBLIC_LEMONSQUEEZY_ENABLED`. Production also requires a non-dummy `BETTER_AUTH_SECRET` of at least 32 characters and identical, path-free HTTPS origins in `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`. The server validates all required runtime integrations at startup and reports every missing value together.

### Production environment

Start from `.env.example` and set real values in the deployment environment. In particular:

- `RESEND_FROM`: a sender on a domain verified in Resend, such as `Store <orders@your-domain.com>`. Production email delivery fails closed when this or `RESEND_API_KEY` is missing.
- `PAYPAL_WEBHOOK_ID`: the ID of the webhook configured in the PayPal Developer Dashboard; it is required to verify PayPal webhook POSTs.
- `NEXT_PUBLIC_PADDLE_ENABLED`: keep `false` for the physical catalog; set `true` only for an approved digital catalog or sandbox testing.
- `PADDLE_PRODUCT_ID`: the approved Paddle catalog product used for per-order non-catalog prices. Subscribe the webhook to `transaction.completed`, `transaction.canceled`, `transaction.past_due`, `adjustment.created`, and `adjustment.updated`.
- `NEXT_PUBLIC_LEMONSQUEEZY_ENABLED`: keep `false` for the physical catalog; set `true` only for an approved digital catalog or test-mode testing.
- `LEMONSQUEEZY_STORE_ID` and `LEMONSQUEEZY_VARIANT_ID`: the store and one-time product variant used for custom-price checkouts. Subscribe the webhook to `order_created` and `order_refunded`.
- `CRON_SECRET`: a random value of at least 32 characters used as the Bearer token for payment reconciliation.
- `DIRECT_URL`: the direct, non-pooled PostgreSQL endpoint used only by migration jobs. `DATABASE_URL` may remain the pooled runtime endpoint.

Schedule `GET /api/cron/reconcile-payments` at least every five minutes and send
`Authorization: Bearer <CRON_SECRET>`. The job expires abandoned hosted checkouts,
releases their inventory/cart locks, and reconciles pending refunds. Configure only
one scheduler; the endpoint and provider operations are idempotent.

Build and migration are intentionally separate. Build the artifact first, run the release step once against the production database, and only then route traffic to the new version:

```powershell
npm run build
npm run release
npm run start
```

`npm run release` rejects common PgBouncer/pooler hostnames before invoking Prisma Migrate. On managed platforms, configure it as a release command rather than running it concurrently in every application instance.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Prisma commands are available as `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, and `db:studio`.
