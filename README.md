# Dropify

For the current manual AliExpress product workflow and launch dependencies, see [AliExpress catalog onboarding](docs/aliexpress-onboarding.md).

A production-oriented bilingual dropshipping storefront and admin dashboard built as one Next.js 16 application. It includes English/Arabic routing and RTL, Better Auth, Prisma/PostgreSQL, guest and customer carts, Stripe/Moyasar/PayPal adapters, internal analytics, and the complete catalog/order/review/settings admin surface.

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
- Public catalog pages can show the bundled demo catalog while a development database is temporarily unavailable. Normal production deployments fail closed instead of exposing demo records; use the explicit Vercel demo mode below only for a temporary UI preview.
- Uploaded images are written to `public/uploads`. This is intended for a persistent, single-node deployment; use durable object storage before deploying to an ephemeral or multi-instance host.

## Real payment configuration

Replace the dummy values in `.env` with sandbox or live credentials, then configure these endpoints:

- Stripe webhook: `/api/webhooks/stripe`
- Moyasar invoice callback: `/api/webhooks/moyasar`
- PayPal return/webhook: `/api/webhooks/paypal`
Set `PAYPAL_MODE=live` only after completing sandbox verification. Production also requires a non-dummy `BETTER_AUTH_SECRET` of at least 32 characters and identical, path-free HTTPS origins in `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`. The server validates all required runtime integrations at startup and reports every missing value together.

### Vercel UI preview (demo mode)

For a temporary Vercel deployment that is only used to inspect the storefront, set `DEMO_MODE=true` in the Vercel environment. Use the deployed origin for both URL variables:

```text
DEMO_MODE=true
BETTER_AUTH_URL=https://ali-dropify.vercel.app
NEXT_PUBLIC_APP_URL=https://ali-dropify.vercel.app
BETTER_AUTH_SECRET=<a random value with at least 32 characters>
DATABASE_URL=<a valid PostgreSQL connection string>
```

Demo mode skips startup requirements for Resend, Stripe, Moyasar, PayPal, and the payment reconciliation cron, and enables the bundled catalog fallback when the database is temporarily unavailable. It does not create fake provider payments or bypass authentication; checkout, email, and other integration routes still need their real credentials. Set `DEMO_MODE=false` (or remove it) and configure every production variable before accepting real orders.

### Production environment

Start from `.env.example` and set real values in the deployment environment. In particular:

- `RESEND_FROM`: a sender on a domain verified in Resend, such as `Store <orders@your-domain.com>`. Production email delivery fails closed when this or `RESEND_API_KEY` is missing.
- `PAYPAL_WEBHOOK_ID`: the ID of the webhook configured in the PayPal Developer Dashboard; it is required to verify PayPal webhook POSTs.
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
