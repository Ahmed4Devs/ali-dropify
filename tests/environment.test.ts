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
} as const;

test("does not require production credentials during development", () => {
  assert.deepEqual(getProductionEnvironmentErrors({ NODE_ENV: "development" }), []);
});

test("accepts a complete production environment", () => {
  assert.deepEqual(getProductionEnvironmentErrors(validProductionEnvironment), []);
  assert.doesNotThrow(() => assertProductionEnvironment(validProductionEnvironment));
});

test("accepts an explicit demo deployment without merchant integrations", () => {
  const demoEnvironment = {
    NODE_ENV: "production",
    DEMO_MODE: "true",
    DATABASE_URL: validProductionEnvironment.DATABASE_URL,
    BETTER_AUTH_SECRET: validProductionEnvironment.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: validProductionEnvironment.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL: validProductionEnvironment.NEXT_PUBLIC_APP_URL,
  };

  assert.deepEqual(getProductionEnvironmentErrors(demoEnvironment), []);
  assert.doesNotThrow(() => assertProductionEnvironment(demoEnvironment));
});

test("keeps the strict production checks when demo mode is disabled", () => {
  const errors = getProductionEnvironmentErrors({
    NODE_ENV: "production",
    DEMO_MODE: "false",
  });

  assert.ok(errors.some((error) => error.includes("CRON_SECRET")));
  assert.ok(errors.some((error) => error.includes("STRIPE_SECRET_KEY")));
  assert.ok(errors.some((error) => error.includes("PAYPAL_MODE")));
});

test("rejects an invalid demo mode value instead of treating it as enabled", () => {
  const errors = getProductionEnvironmentErrors({
    NODE_ENV: "production",
    DEMO_MODE: "yes",
    DATABASE_URL: validProductionEnvironment.DATABASE_URL,
    BETTER_AUTH_SECRET: validProductionEnvironment.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: validProductionEnvironment.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL: validProductionEnvironment.NEXT_PUBLIC_APP_URL,
  });

  assert.ok(errors.some((error) => error.includes('DEMO_MODE must be explicitly set to "true" or "false"')));
  assert.ok(errors.some((error) => error.includes("CRON_SECRET")));
});

test("does not require merchant-of-record credentials when both opt-ins are disabled", () => {
  assert.deepEqual(getProductionEnvironmentErrors({
    ...validProductionEnvironment,
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
