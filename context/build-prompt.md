# Master Build Prompt — Bilingual Dropshipping Storefront

**How to use:** copy everything below the line into your AI coding agent (Claude Code, Cursor, etc.) as a single prompt. All credentials are dummies — swap them in `.env` when you go live. Nothing else needs editing.

---

You are a senior full-stack engineer. Build a complete, production-quality **dropshipping storefront + admin dashboard** as ONE Next.js application. Optimize for simplicity: the fewest pages that fully cover the spec, boring proven patterns, no over-engineering. The store must be 100% generic — no niche hard-coded anywhere — so the same codebase can be redeployed for sportswear, women's dresses, or a single-product electronics store by changing only database content and `.env`.

## 1. Tech stack (exact)

- **Next.js 16.x** (latest), App Router, Server Components + Server Actions, Turbopack
- **React 19.x**, **TypeScript** with `strict: true`
- **Tailwind CSS v4** (CSS-first config) + **shadcn/ui** on Radix primitives
- **Zod** at every input boundary
- **Better-Auth** with the Prisma adapter — email & password credentials + the **email OTP plugin** for code-based sign-in
- **PostgreSQL** with **Prisma 7**
- Payments: **Stripe** (Checkout Sessions), **Moyasar** (hosted payment page), **PayPal** (sandbox Orders v2)
- **next-intl** for i18n: `en` and `ar` with full RTL
- Analytics: **Google Tag Manager**, **Meta Pixel**, **TikTok Pixel**, plus internal view/search tracking

Before writing code, verify the current APIs of Next 16, Tailwind 4, Prisma 7, and Better-Auth against their latest docs (use a docs tool such as Context7 if available). Do not rely on memorized patterns from older major versions.

## 2. Hard rules (non-negotiable)

1. **Types, not interfaces.** The `interface` keyword must not appear in any hand-written code. Create a `/types` folder at the project root with an `index.ts` file, and declare all types there as `type` aliases.
2. `strict: true`, no `any`, no `@ts-ignore`.
3. Every mutation is a Server Action in `/actions`, validated with a Zod schema, returning a typed `{ ok: true, data } | { ok: false, error }` result.
4. Server Components by default; add `"use client"` only where interactivity requires it.
5. All money values are **integers in minor units**. Catalog prices are stored in USD cents; currency conversion happens only at display and checkout.
6. Bilingual by design: every UI string goes through next-intl messages; database content uses `...En` / `...Ar` column pairs. Use Tailwind **logical** utilities everywhere (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `start-0`) so RTL mirrors for free — never `ml-*` / `mr-*`.
7. Build exactly the pages in §7–§8. Do not add pages.
8. Minimal dependencies beyond the stack. Allowed extras: `sonner` (toasts), `recharts` (admin charts), `lucide-react` (icons).
9. Mobile-first. The product page and checkout must be flawless at 375px width.
10. The project must run end-to-end with **zero external accounts**: seed data included, payment keys are test/sandbox dummies, and all emails (verification, OTP codes, order confirmations) are logged to the console in development.

## 3. Folder structure

```
/app
  /[locale]
    /(storefront)
      layout.tsx                 # header, announcement bar, footer, cart drawer
      page.tsx                   # Home
      products/page.tsx          # shop grid (?category=&q=&sort=)
      products/[slug]/page.tsx   # product page
      cart/page.tsx
      checkout/page.tsx
      checkout/success/page.tsx
      account/page.tsx           # tabs: Profile | Addresses | Orders
      sign-in/page.tsx
      sign-up/page.tsx
  /admin
    layout.tsx                   # sidebar shell + ADMIN role guard
    page.tsx                     # dashboard
    products/page.tsx            # products table + Categories tab
    products/new/page.tsx
    products/[id]/page.tsx
    orders/page.tsx
    reviews/page.tsx
    settings/page.tsx
  /api
    auth/[...all]/route.ts       # Better-Auth handler
    webhooks/stripe/route.ts
    webhooks/moyasar/route.ts
    webhooks/paypal/route.ts
/actions        # auth.ts, cart.ts, checkout.ts, reviews.ts, account.ts, admin-*.ts
/components     # ui/ (shadcn), storefront/, admin/, shared/
/lib            # auth.ts, prisma.ts, currency.ts, mail.ts, analytics.ts, payments/{stripe,moyasar,paypal}.ts
/messages       # en.json, ar.json
/prisma         # schema.prisma, seed.ts
/types          # index.ts  ← ALL types live here
/public/uploads # admin image uploads
middleware.ts   # locale routing + /account & /admin guards
```

## 4. `.env.example` (create with exactly these dummy values)

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/store
BETTER_AUTH_SECRET=dummy-secret-change-me
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAIL=owner@example.com
RESEND_API_KEY=re_dummy_123
STRIPE_SECRET_KEY=sk_test_dummy
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
MOYASAR_SECRET_KEY=sk_test_dummy
NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY=pk_test_dummy
PAYPAL_CLIENT_ID=dummy-client-id
PAYPAL_CLIENT_SECRET=dummy-client-secret
PAYPAL_MODE=sandbox
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=000000000000000
NEXT_PUBLIC_TIKTOK_PIXEL_ID=XXXXXXXXXXXXX
```

## 5. Prisma schema

Generate the Better-Auth models (`Session`, `Account`, `Verification`, and the base `User`) with the Better-Auth CLI, configuring `additionalFields` on user for `firstName`, `lastName`, `phone`, and `role`. Then merge with the domain models below:

```prisma
enum Role          { CUSTOMER ADMIN }
enum OrderStatus   { PENDING PAID FULFILLED DELIVERED CANCELLED REFUNDED }
enum PaymentMethod { STRIPE MOYASAR PAYPAL }
enum ReviewSource  { STORE ALIEXPRESS }
enum ReviewStatus  { PENDING APPROVED HIDDEN }

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  firstName     String?
  lastName      String?
  phone         String?
  image         String?            // avatar URL; UI falls back to first letter of firstName
  role          Role      @default(CUSTOMER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
  addresses     Address[]
  orders        Order[]
  reviews       Review[]
  carts         Cart[]
}

model Address {
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  fullName  String
  phone     String?
  country   String
  state     String
  city      String
  street    String
  apartment String?
  zip       String
  isDefault Boolean @default(false)
}

model Category {
  id       String    @id @default(cuid())
  slug     String    @unique
  nameEn   String
  nameAr   String
  image    String?
  sort     Int       @default(0)
  products Product[]
}

model Product {
  id            String      @id @default(cuid())
  slug          String      @unique
  titleEn       String
  titleAr       String
  descriptionEn String      @db.Text
  descriptionAr String      @db.Text
  priceUsd      Int                       // USD cents
  compareAtUsd  Int?
  costUsd       Int         @default(0)   // supplier cost → profit reports
  images        String[]
  tags          String[]
  inStock       Boolean     @default(true)
  isFeatured    Boolean     @default(false)
  aliexpressUrl String?
  categoryId    String?
  category      Category?   @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  variants      Variant[]
  reviews       Review[]
  orderItems    OrderItem[]
  viewsTotal    Int         @default(0)
  salesCount    Int         @default(0)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@index([categoryId])
}

model Variant {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  titleEn   String            // e.g. "Red / XL"
  titleAr   String
  options   Json              // { "color": "Red", "size": "XL" }
  priceUsd  Int?              // null → product price
  inStock   Boolean @default(true)
}

model Cart {
  id           String     @id @default(cuid())
  userId       String?
  user         User?      @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionToken String?    @unique   // guest carts via httpOnly cookie
  items        CartItem[]
  updatedAt    DateTime   @updatedAt
}

model CartItem {
  id        String  @id @default(cuid())
  cartId    String
  cart      Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId String
  variantId String?
  quantity  Int     @default(1)
  @@unique([cartId, productId, variantId])
}

model Order {
  id              String         @id @default(cuid())
  orderNumber     String         @unique     // sequential, human-readable, e.g. "1001"
  userId          String?
  user            User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  email           String
  phone           String?
  status          OrderStatus    @default(PENDING)
  currency        String                      // "USD" | "SAR" | "AUD"
  fxRate          Decimal        @default(1)  // units of currency per 1 USD at purchase
  subtotal        Int                         // charged-currency minor units
  shippingFee     Int            @default(0)
  total           Int
  paymentMethod   PaymentMethod?
  paymentRef      String?
  shippingAddress Json                        // snapshot of the address
  items           OrderItem[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String?
  product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  titleEn     String                    // snapshot
  image       String?
  variant     Json?
  unitPrice   Int                       // charged currency, minor units
  unitCostUsd Int      @default(0)
  quantity    Int
}

model Review {
  id         String       @id @default(cuid())
  productId  String
  product    Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId     String?
  user       User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  authorName String
  rating     Int                             // 1..5, validated by Zod
  comment    String       @db.Text
  images     String[]
  source     ReviewSource @default(STORE)
  status     ReviewStatus @default(PENDING)
  createdAt  DateTime     @default(now())
  @@index([productId, status])
}

model ProductView {
  id        String   @id @default(cuid())
  productId String
  date      DateTime @db.Date
  count     Int      @default(0)
  @@unique([productId, date])
}

model SearchLog {
  id     String   @id @default(cuid())
  term   String   @unique
  count  Int      @default(1)
  lastAt DateTime @default(now())
}

model StoreSetting {
  id                  String  @id @default("main")
  storeName           String  @default("My Store")
  logoUrl             String?
  announcementEn      String?
  announcementAr      String?
  announcementEnabled Boolean @default(true)
  heroTitleEn         String?
  heroTitleAr         String?
  heroSubtitleEn      String?
  heroSubtitleAr      String?
  heroImage           String?
  heroCtaEn           String? @default("Shop Now")
  heroCtaAr           String? @default("تسوق الآن")
  valueProps          Json?   // [{ icon, titleEn, titleAr, textEn, textAr }]
  shippingFlatUsd     Int     @default(499)
  freeShippingMinUsd  Int?    @default(5000)
  deliveryEstimateEn  String? @default("Delivery in 7–15 business days")
  deliveryEstimateAr  String? @default("التوصيل خلال ٧–١٥ يوم عمل")
  sarPerUsd           Decimal @default(3.75)
  audPerUsd           Decimal @default(1.55)
  supportEmail        String?
  supportWhatsapp     String?
  socialLinks         Json?
}
```

## 6. Authentication (Better-Auth)

- **Sign-up:** first name, last name, email, password (Zod-validated) → sends a verification email (console in dev).
- **Sign-in:** two tabs — "Password" and "Email me a code" (email OTP plugin sends a 6-digit code, logged to console in dev).
- Session cookie via Better-Auth. `middleware.ts`: `/{locale}/account` requires a session; `/admin/*` requires `role === "ADMIN"` (otherwise render 404, not 403).
- The seed script creates the admin user from `ADMIN_EMAIL` with role ADMIN.
- **Account page** (single page, three tabs):
  - *Profile:* first/last name, phone, avatar upload to `/public/uploads` (max 2 MB, jpeg/png/webp). Use shadcn `Avatar` with `AvatarFallback` showing the first letter of the first name.
  - *Addresses:* CRUD with fields country, state, city, street, apartment/building, zip, phone; one default.
  - *Orders:* list (number, date, total, status badge) with an expandable detail view.

## 7. Storefront (all under `app/[locale]/(storefront)`)

**Layout:** header with logo (from settings), search input (submits to `/products?q=`), locale switcher (EN/عربي), currency switcher (USD/SAR/AUD, persisted in a cookie), cart button with item-count badge (opens the cart drawer), account menu. Announcement bar above the header when enabled. Footer with quick links, support contacts, social icons, and payment-method trust badges (Visa, Mastercard, mada, PayPal, Stripe).

**`/` Home**, in order:
1. Hero: settings image + bilingual title/subtitle, CTA button → `/products`.
2. Featured categories: image cards, link to `/products?category=slug`.
3. Best sellers: top 8 by `salesCount` (fall back to `isFeatured`), rendered as ProductCards.
4. Value propositions: icon row from settings (defaults: fast shipping, secure payment, easy returns, 24/7 support).
5. Testimonials: top approved reviews that have images — photo, stars, comment, author.

**`/products`:** responsive grid (2 cols mobile / 4 desktop), category filter chips, search via `?q=` (log the term to `SearchLog`), sort by newest / price low-high / price high-low, pagination or "load more". **ProductCard:** image, localized title, price (+ strikethrough compare-at), star average, stock badge, quick add-to-cart.

**`/products/[slug]`** — the most important page:
- Image gallery with thumbnails (support alicdn.com remote images via `next.config` `remotePatterns`).
- Localized title (clean, not keyword-stuffed), star rating + review count, price block with compare-at strikethrough and a "Save X%" badge.
- Variant selectors generated from `options`: color swatches for a "color" option, pill buttons otherwise; selecting a combination resolves the matching Variant (price + stock).
- Quantity stepper, **Add to Cart** (opens drawer) and **Buy Now** (adds + goes straight to `/checkout`), both disabled with an "Out of stock" state when unavailable.
- Shipping info block: delivery estimate + free-shipping note from settings.
- Accordion: Description (rich text) | Shipping & Returns.
- Reviews section: average + histogram (5→1 bars), review list with photos and "Verified purchase" badge for STORE reviews, and a review form shown only to signed-in users who have a PAID/FULFILLED/DELIVERED order containing this product.
- Related products: 4 from the same category.
- Sticky bottom add-to-cart bar on mobile.
- Fires the ViewContent event and increments the daily `ProductView` rollup + `viewsTotal` (fire-and-forget server call).

**`/cart`:** full page mirroring the drawer — line items (image, title, variant, unit price), quantity steppers, remove, subtotal, free-shipping progress bar, checkout CTA. Guest carts use an httpOnly cookie token; on sign-in, merge the guest cart into the user's cart.

**`/checkout`** — one page, no multi-step wizard:
- Contact: email (prefilled if signed in) + phone.
- Shipping address: saved-address picker for signed-in users, or the full form (country, state, city, street, apartment, zip). Zod-validate everything.
- Order summary with converted prices in the selected currency.
- Payment method radio group with logos, filtered by currency: USD → Stripe, PayPal · SAR → Stripe, Moyasar · AUD → Stripe, PayPal.
- "Place order" server action: create the Order as PENDING (snapshot items, prices, `fxRate`, address), then redirect to the gateway's hosted page. Fires InitiateCheckout.

**`/checkout/success?order=...`:** thank-you screen with order number, items, totals, and "what happens next". Fires the Purchase event exactly once per order (guard with `sessionStorage` keyed by order number).

## 8. Admin (`app/admin`, LTR English is fine)

Shell: sidebar (Dashboard, Products, Orders, Reviews, Settings) + topbar with store name and "View store" link.

- **`/admin` Dashboard:** KPI cards — Revenue, Orders, **Profit** (Σ(unitPrice − unitCostUsd·fxRate)·qty for PAID+), Average order value — with a 7/30/90-day range selector; sales-over-time line chart (recharts); best sellers by revenue; most-viewed products (from ProductView); top search terms (from SearchLog); recent orders; out-of-stock products list.
- **`/admin/products`:** table (thumbnail, title, price, cost, margin %, stock badge, category, featured, created) with edit/delete (confirm dialog) actions; a second tab "Categories" with dialog-based CRUD (slug, nameEn, nameAr, image).
- **`/admin/products/new` and `[id]`:** one form — EN/AR field pairs side by side; slug auto-generated from the English title (editable); price / compare-at / cost as money inputs; category select; tags input; inStock and isFeatured switches; AliExpress URL field; images: multi-file upload to `/public/uploads` **and** "paste image URL" (accepts alicdn links), thumbnails with drag-to-reorder and delete; variants builder: define option names + values → auto-generate the combinations table with per-row price override and stock toggle.
- **`/admin/orders`:** table (number, date, customer, items count, total, profit, payment method, status) with status/date filters; row opens a detail Sheet: items with images, address, payment ref, totals + profit, status select (PENDING → PAID → FULFILLED → DELIVERED / CANCELLED / REFUNDED), and a **fulfillment helper**: per-item AliExpress source link + a "Copy shipping info" button that copies name / phone / street / apartment / city / state / zip / country as a plain-text block ready to paste into AliExpress checkout.
- **`/admin/reviews`:** moderation table (product, author, stars, comment, source badge, status) with Approve/Hide actions, filter by status/source; an **Import reviews** dialog: pick a product, paste a JSON array or CSV with columns `author, rating, comment, imageUrls` → created as source ALIEXPRESS, status PENDING.
- **`/admin/settings`:** grouped forms saving to the StoreSetting singleton — Branding (store name, logo), Announcement (En/Ar + toggle), Hero (En/Ar texts, image, CTA), Value props (repeatable rows), Shipping (flat fee, free-shipping threshold, delivery estimate En/Ar), Currency rates (SAR and AUD per USD), Support (email, WhatsApp), Social links.

## 9. Payments

Define one shared adapter type in `/types/index.ts` and implement it in `lib/payments/`:

```ts
type PaymentAdapter = {
  createPayment: (order: OrderForPayment) => Promise<{ redirectUrl: string }>;
  // each gateway also gets a webhook handler in /api/webhooks/*
};
```

- **Stripe:** create a Checkout Session in the order's currency with line items, `success_url` → `/checkout/success?order=...`, `cancel_url` → `/checkout`. Webhook: verify signature, on `checkout.session.completed` call `markOrderPaid`.
- **Moyasar:** SAR only. Create a hosted payment with amount in halalas, callback URL back to the store; on callback/webhook, fetch the payment status from Moyasar's API server-side and only then `markOrderPaid`. Support mada + cards.
- **PayPal:** sandbox mode, USD/AUD only. Orders v2: create → approval redirect → capture on return; confirm the capture server-side (plus webhook) before `markOrderPaid`.
- **`markOrderPaid(orderId, method, paymentRef)`** in one shared module: idempotent — only transitions PENDING → PAID; increments each product's `salesCount`; sends the order-confirmation email (console in dev).
- All keys come from `.env`; never hard-code. Handle webhook signature failures with 400s and log clearly.

## 10. Analytics

- `components/shared/analytics.tsx` in the root layout: injects the GTM script + noscript, Meta Pixel, and TikTok Pixel — each **only if** its `NEXT_PUBLIC_*` ID is set.
- `lib/analytics.ts` exports `track(event, payload)` which pushes `{ event, ...payload }` to `window.dataLayer` and calls `fbq`/`ttq` when loaded.

| Trigger | dataLayer event | Meta | TikTok | Payload |
|---|---|---|---|---|
| Product page view | `view_item` | ViewContent | ViewContent | content_ids, value, currency |
| Add to cart | `add_to_cart` | AddToCart | AddToCart | content_ids, value, currency, quantity |
| Checkout started | `begin_checkout` | InitiateCheckout | InitiateCheckout | value, currency, num_items |
| Order confirmed | `purchase` | Purchase | CompletePayment | order_id, content_ids, value, currency |

- Internal analytics (no external service): server actions `incrementProductView(productId)` (upsert today's ProductView row + bump `viewsTotal`) and `logSearch(term)` (normalize, upsert count). Both fire-and-forget — never block rendering.

## 11. Design & branding

Minimalist and trustworthy: white/neutral background, one primary brand color defined as a CSS variable in the Tailwind v4 theme (so each store re-skins by changing one value), generous whitespace, `rounded-xl` cards with subtle borders, no gradients or visual noise. Fonts via `next/font`: Inter for Latin, Cairo for Arabic, applied per locale. Skeleton loaders for grids and the product page, friendly empty states with CTAs, `sonner` toasts for cart/auth/admin feedback, proper `alt` text and form labels throughout. Use shadcn components (button, card, input, select, form, dialog, sheet, tabs, accordion, badge, avatar, table, dropdown-menu, radio-group, skeleton, separator, sonner) rather than building primitives from scratch.

## 12. Seed data (`prisma/seed.ts`)

- StoreSetting defaults: announcement "Free shipping on orders over $50" (+ Arabic), hero copy En/Ar, 4 value props, rates 3.75 / 1.55, flat shipping $4.99, free-shipping threshold $50, delivery estimate texts.
- Admin user: `ADMIN_EMAIL` / password `Admin123!`, verified, role ADMIN. One demo customer with an address.
- 3 categories (bilingual) and ~10 products spread across them: some with color+size variants, at least one single-variant "smart watch"-style product; realistic USD prices and supplier costs; placeholder images from `https://picsum.photos` (add it and `*.alicdn.com` to `images.remotePatterns`).
- ~24 reviews: a mix of ALIEXPRESS/APPROVED with photos, STORE verified, and a few PENDING.
- 6–8 PAID demo orders spread over the last 30 days, plus ProductView and SearchLog rows — so the dashboard charts render real-looking data on first run.

## 13. Build order

1. Scaffold: create-next-app (TS), Tailwind v4, shadcn init, base config.
2. Prisma 7 schema + migration; `lib/prisma.ts`.
3. Better-Auth: config, CLI-generated models, email OTP plugin, `/api/auth`, middleware guards, `lib/mail.ts` (console transport in dev).
4. next-intl: `[locale]` routing, `messages/en.json` + `ar.json`, RTL wiring, fonts.
5. `/types/index.ts` + `lib/currency.ts` (convert + `Intl.NumberFormat` formatting).
6. Seed script; verify `db seed` output.
7. Storefront layout: header, announcement bar, footer, cart drawer shell.
8. Home page sections.
9. `/products` grid + `/products/[slug]`.
10. Cart: cookie sessions, actions, drawer + page, merge-on-login.
11. Checkout page + payment adapters + webhooks + success page.
12. Account page (profile / addresses / orders), avatar upload.
13. Admin shell + dashboard queries and charts.
14. Admin products (form, images, variants builder), orders (+ fulfillment helper), reviews (+ import), settings.
15. Analytics provider + event wiring.
16. Final pass: RTL audit on every page, 375px mobile audit, `tsc --noEmit` clean, grep confirms no `interface` in hand-written code.

## 14. Acceptance checklist

- [ ] `pnpm install`, migrate, seed, and `pnpm dev` succeed with only `.env.example` values; zero TypeScript errors.
- [ ] `grep -rn "interface " app actions components lib types` returns nothing.
- [ ] `/ar` renders fully RTL with translated UI chrome and Arabic product content; layout mirrors correctly (logical utilities).
- [ ] Currency switcher converts every displayed price; SAR uses the 3.75 default rate; order stores currency + fxRate.
- [ ] Sign-up sends a verification email to the console; "Email me a code" sign-in works with the console-logged OTP.
- [ ] Guest can add to cart; signing in merges the guest cart.
- [ ] Full purchase with a Stripe test card: order goes PENDING → PAID via webhook, appears in admin with correct totals and profit, success page fires `purchase` to the dataLayer exactly once.
- [ ] Moyasar (SAR) and PayPal (USD/AUD) flows run against sandbox endpoints; payment methods are correctly filtered by currency at checkout.
- [ ] Admin can create a product with variants and a pasted alicdn image URL; it renders on the storefront; deleting asks for confirmation.
- [ ] Review form appears only for a purchaser of that product; imported AliExpress reviews arrive PENDING and show after approval; testimonials on Home pull approved photo reviews.
- [ ] Dashboard shows revenue, profit, most-viewed, and top-searches populated from seed data; out-of-stock list works.
- [ ] Announcement bar, hero, value props, shipping fee/threshold, and currency rates are all editable in Settings and reflected on the storefront without code changes.
- [ ] Product page and checkout are clean and fully usable at 375px; images lazy-load through `next/image`.
