# Dropshipping Storefront — System Design

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · Zod · Better-Auth · PostgreSQL + Prisma 7 · Stripe / Moyasar / PayPal · GTM + Meta Pixel + TikTok Pixel · English & Arabic · USD / SAR / AUD

**Design goals:** the fewest pages that cover everything, no over-engineering, one generic codebase you can redeploy for any niche (sportswear, dresses, or a single-product electronics store), bilingual with proper RTL from day one, and a conversion-focused product page — since that's where your ad traffic lands.

---

## 1. One codebase, many stores

Nothing niche-specific is hard-coded. A single `StoreSetting` row in the database drives all branding and marketing content: store name, logo, announcement bar text, hero content, value propositions, shipping rules, currency rates, and support contacts. Products and categories are just data.

**To launch a new store:** deploy the same repo with a fresh database and `.env`, then fill in settings and products from the admin panel. That's it — no code changes between your sportswear store and your smartwatch store.

## 2. Architecture at a glance

One Next.js application, two surfaces, one database:

```
┌─ /[locale] storefront (en/ar) ─┐    ┌─ /admin (ADMIN role only) ─┐
│  Server Components (reads)     │    │  Dashboard, CRUD, settings │
│  Server Actions (writes, Zod)  │    │  Server Actions (writes)   │
└───────────────┬────────────────┘    └──────────────┬─────────────┘
                └────────── Prisma 7 → PostgreSQL ───┘
     /api routes exist ONLY for: Better-Auth handler + 3 payment webhooks
```

Server Components handle all reads; every write goes through a Zod-validated Server Action. No separate backend, no microservices, no queues — deliberately boring and easy to maintain.

## 3. Site map (kept deliberately small)

**Storefront** — all under `/[locale]` (`en`, `ar`):

| Route | Purpose |
|---|---|
| `/` | Home: announcement bar, hero, featured categories, best sellers, value props, testimonials |
| `/products` | One shop page with `?category=` and `?q=` filters (replaces separate category + search pages) |
| `/products/[slug]` | The product page — the conversion machine |
| `/cart` | Cart page (plus a slide-out drawer that opens on add-to-cart) |
| `/checkout` | Single-page checkout: contact + address + payment method |
| `/checkout/success` | Order confirmation (fires the Purchase pixel, once) |
| `/account` | One page with tabs: Profile · Addresses · Orders |
| `/sign-in`, `/sign-up` | Auth (password or email code) |

**Admin** — under `/admin`, visible only to the ADMIN role:

| Route | Purpose |
|---|---|
| `/admin` | Dashboard: revenue, orders, profit, charts, most viewed, top searches |
| `/admin/products` | Product table + a Categories tab (categories managed here, no extra page) |
| `/admin/products/new`, `/admin/products/[id]` | Create / edit product |
| `/admin/orders` | Orders table + detail sheet with a fulfillment helper |
| `/admin/reviews` | Moderate reviews + import AliExpress reviews |
| `/admin/settings` | Branding, announcement, hero, shipping, currency rates, contacts |

Fifteen screens total. That's the whole site.

## 4. Data model

All prices are stored as **integers in USD cents** (base currency); orders record the charged currency and the exchange rate used, so your reports never drift.

| Model | What it holds |
|---|---|
| `User`, `Session`, `Account`, `Verification` | Better-Auth tables; `User` extended with `firstName`, `lastName`, `phone`, `image` (avatar), `role` (CUSTOMER / ADMIN) |
| `Address` | Country, state, city, street, apartment, zip, default flag — per customer |
| `Category` | Slug + bilingual name (`nameEn` / `nameAr`) + image |
| `Product` | Slug, bilingual title & description, `priceUsd`, `compareAtUsd`, `costUsd` (your AliExpress cost → profit reports), `images[]`, `tags[]`, `inStock` (renders the In stock / Out of stock badge), `isFeatured`, `aliexpressUrl`, `salesCount`, `viewsTotal` |
| `Variant` | Bilingual title ("Red / XL"), `options` JSON, optional price override, own `inStock` |
| `Cart`, `CartItem` | Guest carts via a cookie token; merged into the user's cart on login |
| `Order`, `OrderItem` | Snapshots of title/image/price at purchase time, unit cost (for profit), currency + FX rate, shipping address JSON, status lifecycle (PENDING → PAID → FULFILLED → DELIVERED, or CANCELLED/REFUNDED) |
| `Review` | Rating 1–5, comment, photos, `source` (STORE / ALIEXPRESS), `status` (PENDING / APPROVED / HIDDEN) |
| `ProductView`, `SearchLog` | Daily per-product view rollups + search-term counters — power the "most viewed / most searched" dashboards with zero external services |
| `StoreSetting` | The singleton from §1 |

The full Prisma schema is in the build prompt, ready to paste.

## 5. Authentication & accounts (Better-Auth)

Sign-up asks for first name, last name, email, and password, then sends a verification email. Sign-in offers two tabs: **Password** or **Email me a code** (Better-Auth's email OTP plugin — exactly the flow you described). Middleware protects `/account` (any session) and `/admin` (ADMIN role only; others get a 404). The account whose email matches the `ADMIN_EMAIL` env variable is promoted to admin at seed time.

The profile tab lets customers set names, phone, and upload an avatar; if there's no avatar, the shadcn `Avatar` component falls back to the first letter of the first name automatically.

## 6. Catalog & product management

Products are edited with English and Arabic fields side by side. Images can be **uploaded** (stored under `/public/uploads` via a server action — no external service needed) or **pasted as AliExpress CDN URLs** (`next.config` whitelists `*.alicdn.com` so they render through `next/image`). Variants work by defining options (Color: Red, Blue · Size: M, L); combinations are generated, each with its own stock flag and optional price. Turning `inStock` off shows the localized "Out of stock" badge and disables purchase.

## 7. Cart & checkout flow

```
Add to cart → drawer opens → /checkout (contact + address + payment method)
→ order created as PENDING → redirect to the gateway's hosted payment page
→ gateway webhook confirms → order becomes PAID (idempotent)
→ /checkout/success → Purchase event fired exactly once
```

Guests can buy without an account (email required); their cookie-based cart merges into their account if they sign in. "Buy Now" on the product page skips straight to checkout. A free-shipping progress bar ("You're $12 away from free shipping") uses the threshold from settings — a proven conversion booster.

## 8. Payments

A small adapter layer in `lib/payments/` gives all three gateways the same shape, so adding or removing one later is trivial.

| Gateway | Flow | Currencies |
|---|---|---|
| **Stripe** | Checkout Session (hosted) | USD, SAR, AUD |
| **Moyasar** | Hosted payment page — mada + cards, the go-to for Saudi customers | SAR |
| **PayPal** | Sandbox Orders API | USD, AUD (PayPal doesn't process SAR) |

Checkout only shows the methods valid for the selected currency. All keys are dummy `.env` values you swap later; webhooks verify signatures, and the PENDING → PAID transition is idempotent (a replayed webhook can't double-count an order). Using hosted payment pages keeps you out of PCI scope and keeps the code simple.

## 9. i18n, RTL & currency

Routing is `/en/...` and `/ar/...` via next-intl; the `<html>` element gets `dir="rtl"` for Arabic. All layout uses Tailwind **logical** utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`) so the entire UI mirrors correctly with zero per-page RTL fixes. Fonts: Inter for Latin, Cairo for Arabic, loaded per-locale with `next/font`. UI strings live in `messages/en.json` and `messages/ar.json`; product and category content comes from the bilingual database columns.

A currency switcher (persisted in a cookie) converts the USD base price using fixed, admin-editable rates in settings (defaults: 3.75 SAR / 1.55 AUD per USD). Prices are formatted with `Intl.NumberFormat`, so SAR renders as ر.س in Arabic automatically.

## 10. Analytics

One `<AnalyticsProvider>` injects GTM, Meta Pixel, and TikTok Pixel — each only if its `NEXT_PUBLIC_*` ID is set in `.env`. A single `track()` helper pushes to the GTM `dataLayer` and calls `fbq` / `ttq` in one place:

| Moment | GTM event | Meta | TikTok |
|---|---|---|---|
| Product page view | `view_item` | ViewContent | ViewContent |
| Add to cart | `add_to_cart` | AddToCart | AddToCart |
| Checkout started | `begin_checkout` | InitiateCheckout | InitiateCheckout |
| Payment confirmed | `purchase` | Purchase | CompletePayment |

All events carry `content_ids`, `value`, and `currency`, so your ad platforms can optimize properly. Separately, **internal** tracking (product views rolled up daily, search terms counted) feeds the admin dashboard — your "most viewed" and "most searched" numbers don't depend on any external tool.

## 11. Reviews & social proof

Customers can review and rate (1–5 stars) only products from their own paid orders — those show a "Verified purchase" badge. In admin, an **Import reviews** dialog accepts pasted JSON or CSV (author, rating, comment, image URLs) exported from an AliExpress review tool; imports arrive as `source: ALIEXPRESS`, `status: PENDING`, and you approve only the good ones — that's your filter. The storefront shows approved reviews only, and the home-page testimonials section pulls the best approved reviews that have photos.

## 12. Admin dashboard

KPI cards (Revenue, Orders, **Profit** = price − cost, Average order value) with a 7/30/90-day selector, a sales chart, best sellers by revenue, most-viewed products, top search terms, recent orders, and an out-of-stock alert list.

The orders screen includes a **fulfillment helper**: each order shows the source AliExpress link per item and a "Copy shipping info" button that copies the customer's name, phone, and full address formatted for pasting straight into AliExpress checkout — making manual fulfillment a 60-second job.

## 13. Deliberate v1 simplifications

| Simplification | Why | Upgrade path later |
|---|---|---|
| Manual fulfillment (copy-paste helper) | The AliExpress ordering API requires approval and adds real complexity | DSers / AliExpress Open Platform integration |
| Hosted payment pages | Tiny PCI scope, far fewer bugs | Embedded card elements |
| Fixed FX rates in settings | No external dependency; SAR is pegged anyway | Live FX rate API |
| Flat shipping fee + free-shipping threshold | Simple and predictable | Zone-based rates |
| Local image uploads (`/public/uploads`) | Zero external services | S3 / UploadThing |
| Transactional email only (console in dev) | Keeps scope tight | Abandoned-cart & marketing flows |

## 14. Environment variables

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/store
BETTER_AUTH_SECRET=dummy-secret-change-me
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAIL=owner@example.com

# Email (logged to console in dev)
RESEND_API_KEY=re_dummy_123

# Stripe
STRIPE_SECRET_KEY=sk_test_dummy
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy

# Moyasar
MOYASAR_SECRET_KEY=sk_test_dummy
NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY=pk_test_dummy

# PayPal (sandbox)
PAYPAL_CLIENT_ID=dummy-client-id
PAYPAL_CLIENT_SECRET=dummy-client-secret
PAYPAL_MODE=sandbox

# Analytics (each loads only if set)
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=000000000000000
NEXT_PUBLIC_TIKTOK_PIXEL_ID=XXXXXXXXXXXXX
```
