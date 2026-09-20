import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProductionEnvironment,
  getProductionEnvironmentErrors,
} from "../lib/environment";

const validProductionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://store:secret@db.internal:5432/store?schema=public",
  BETTER_AUTH_SECRET: "a-secure-auth-secret-that-is-longer-than-32-characters",
  CRON_SECRET: "a-secure-cron-secret-that-is-longer-than-32-characters",
  BETTER_AUTH_URL: "https://shop.test",
  NEXT_PUBLIC_APP_URL: "https://shop.test",
  RESEND_API_KEY: "re_live_valid",
  RESEND_FROM: "Store <orders@shop.test>",
  STRIPE_SECRET_KEY: "sk_live_valid",
  STRIPE_WEBHOOK_SECRET: "whsec_valid",
  MOYASAR_SECRET_KEY: "sk_live_moyasar",
  PAYPAL_CLIENT_ID: "paypal-client-live",
  PAYPAL_CLIENT_SECRET: "paypal-secret-live",
  PAYPAL_WEBHOOK_ID: "paypal-webhook-live",
  PAYPAL_MODE: "live",
  NEXT_PUBLIC_PADDLE_ENABLED: "true",
  PADDLE_API_KEY: "pdl_live_valid",
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_valid",
  PADDLE_WEBHOOK_SECRET: "pdl_webhook_valid",
  PADDLE_PRODUCT_ID: "pro_valid",
  PADDLE_ENV: "live",
  NEXT_PUBLIC_LEMONSQUEEZY_ENABLED: "true",
  LEMONSQUEEZY_API_KEY: "ls_live_valid",
  LEMONSQUEEZY_WEBHOOK_SECRET: "ls_webhook_valid",
  LEMONSQUEEZY_STORE_ID: "12345",
  LEMONSQUEEZY_VARIANT_ID: "67890",
  LEMONSQUEEZY_TEST_MODE: "false",
} as const;

test("does not require production credentials during development", () => {
  assert.deepEqual(getProductionEnvironmentErrors({ NODE_ENV: "development" }), []);
});

test("accepts a complete production environment", () => {
  assert.deepEqual(getProductionEnvironmentErrors(validProductionEnvironment), []);
  assert.doesNotThrow(() => assertProductionEnvironment(validProductionEnvironment));
});

test("does not require merchant-of-record credentials when both opt-ins are disabled", () => {
  assert.deepEqual(getProductionEnvironmentErrors({
    ...validProductionEnvironment,
    NEXT_PUBLIC_PADDLE_ENABLED: "false",
    PADDLE_API_KEY: undefined,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: undefined,
    PADDLE_WEBHOOK_SECRET: undefined,
    PADDLE_PRODUCT_ID: undefined,
    PADDLE_ENV: undefined,
    NEXT_PUBLIC_LEMONSQUEEZY_ENABLED: "false",
    LEMONSQUEEZY_API_KEY: undefined,
    LEMONSQUEEZY_WEBHOOK_SECRET: undefined,
    LEMONSQUEEZY_STORE_ID: undefined,
    LEMONSQUEEZY_VARIANT_ID: undefined,
    LEMONSQUEEZY_TEST_MODE: undefined,
  }), []);
});

test("reports all missing production integrations together", () => {
  const errors = getProductionEnvironmentErrors({ NODE_ENV: "production" });
  for (const name of [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "CRON_SECRET",
    "BETTER_AUTH_URL",
    "NEXT_PUBLIC_APP_URL",
    "RESEND_API_KEY",
    "RESEND_FROM",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "MOYASAR_SECRET_KEY",
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
    "PAYPAL_MODE",
    "NEXT_PUBLIC_PADDLE_ENABLED",
    "NEXT_PUBLIC_LEMONSQUEEZY_ENABLED",
  ]) {
    assert.ok(errors.some((error) => error.includes(name)), `expected an error for ${name}`);
  }
});

test("rejects unsafe or inconsistent public origins", () => {
  const errors = getProductionEnvironmentErrors({
    ...validProductionEnvironment,
    BETTER_AUTH_URL: "http://shop.test",
    NEXT_PUBLIC_APP_URL: "https://checkout.test/path",
  });

  assert.ok(errors.some((error) => error.includes("BETTER_AUTH_URL must use HTTPS")));
  assert.ok(errors.some((error) => error.includes("NEXT_PUBLIC_APP_URL must be an origin")));
  assert.ok(errors.some((error) => error.includes("must use the same origin")));
});

test("rejects dummy secrets instead of starting a production server", () => {
  assert.throws(
    () => assertProductionEnvironment({
      ...validProductionEnvironment,
      STRIPE_SECRET_KEY: "sk_live_dummy",
      PAYPAL_MODE: "production",
    }),
    /STRIPE_SECRET_KEY[\s\S]*PAYPAL_MODE/,
  );
});

test("rejects placeholder Lemon Squeezy IDs and invalid provider modes", () => {
  const errors = getProductionEnvironmentErrors({
    ...validProductionEnvironment,
    PADDLE_ENV: "production",
    LEMONSQUEEZY_STORE_ID: "000000",
    LEMONSQUEEZY_VARIANT_ID: "variant-one",
    LEMONSQUEEZY_TEST_MODE: "yes",
  });

  assert.ok(errors.some((error) => error.includes("PADDLE_ENV")));
  assert.ok(errors.some((error) => error.includes("LEMONSQUEEZY_STORE_ID")));
  assert.ok(errors.some((error) => error.includes("LEMONSQUEEZY_VARIANT_ID")));
  assert.ok(errors.some((error) => error.includes("LEMONSQUEEZY_TEST_MODE")));
});
