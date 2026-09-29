# AliExpress catalog onboarding

## What is available now

- New products start as drafts. Drafts stay out of the storefront, product pages, sitemap, and checkout.
- An administrator can save a canonical HTTPS AliExpress item URL. The item ID is extracted and stored. Each product variant has a field for its AliExpress SKU ID and an optional supplier cost override; linked variants need unique IDs before publishing.
- A paid order stores a snapshot of the supplier URL, item ID, and variant SKU ID. The admin can record the supplier order reference, carrier, tracking number, and HTTPS tracking URL for each line. Signed-in customers see tracking in their account; guests with their order receipt cookie see it on the order success page.
- Moving a sourced order to `FULFILLED` requires a supplier order reference for every sourced line.
- Existing products remain visible after the migration. Review their supplier mapping and shipping economics before treating them as ready for sale; the new mapping requirement applies when a draft is first published.

## Manual first-product workflow

1. Apply the new migration on a separate staging database with `npm run db:deploy`. Check `npx prisma migrate status` before using the admin pages. Do not run the demo seed on production.
2. In **Admin → Products → Add product**, enter bilingual content, a real selling price, supplier cost, approved images, and an AliExpress item URL. Leave **Published in store** off.
3. If the supplier item has options, match every store variant to its numeric AliExpress SKU ID. Verify that the visible color/size, supplier SKU, item cost, and stock agree.
4. Check the supplier's delivered price and realistic delivery time for each selling country. The store currently charges one flat shipping fee and does not fetch live supplier shipping quotes.
   Checkout currently accepts Saudi Arabia shipping addresses only. Verify that each supplier listing actually ships to the Saudi destination and that the configured flat fee covers it before publishing.
5. Publish only after reviewing product claims, image usage, margin after shipping/payment fees, and returns. Use sandbox payment for an end-to-end staging order.
6. For a paid order, use the saved supplier link and address to place the supplier order manually. Save its reference on each line. When the carrier issues tracking, add it in the order panel and verify the customer account display.

## Remaining launch dependencies

- **Automated import, inventory sync, and supplier ordering:** require approved AliExpress API access and the specific product/order scopes. No scraping or unauthenticated checkout automation is included. The stored item and SKU IDs provide the mapping for a future connector.
- **Real payments and email:** configure production gateway/webhook and Resend credentials, then run sandbox success, failure, duplicate webhook, expiration, and refund flows. Configure the payment reconciliation scheduler.
- **Shipping and tax:** define supported destinations, shipping charges, delivery promises, return rules, tax treatment, and invoices. The current flat shipping fee is not a supplier quote.
- **Images:** the current `public/uploads` storage needs a persistent single-node disk or an object-storage implementation before ephemeral or multi-instance deployment.
- **Operations:** verify migrations on the actual deployment database; add monitoring, backups, restore drill, and a full database-backed purchase/fulfillment test. A passing build or unit test suite does not replace these checks.
