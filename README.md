# Dropify

A production-oriented bilingual dropshipping storefront and admin dashboard built as one Next.js 16 application. It includes English/Arabic routing and RTL, Better Auth, Prisma/PostgreSQL, guest and customer carts, Stripe/Moyasar/PayPal adapters, internal analytics, and the complete catalog/order/review/settings admin surface.

## Local setup

Requirements: Node.js 20.19+, 22.12+, or 24+, plus an already-running local PostgreSQL server. Update `DATABASE_URL` in `.env` if your connection differs from the example value.

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

Set `PAYPAL_MODE=live` only after completing sandbox verification. Production also requires a non-dummy `BETTER_AUTH_SECRET` of at least 32 characters and HTTPS values for the auth/application URLs.

### Production-only environment additions

Keep the prompt-required `.env.example` unchanged. Add these values directly to the production runtime environment:

- `RESEND_FROM`: a sender on a domain verified in Resend, such as `Store <orders@your-domain.com>`. Production email delivery fails closed when this or `RESEND_API_KEY` is missing.
- `PAYPAL_WEBHOOK_ID`: the ID of the webhook configured in the PayPal Developer Dashboard; it is required to verify PayPal webhook POSTs.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Prisma commands are available as `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, and `db:studio`.
