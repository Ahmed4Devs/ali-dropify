type Environment = Readonly<Record<string, string | undefined>>;

const PLACEHOLDER_PATTERN = /(?:dummy|change[-_ ]?me|x{4,}|your[-_ ]?(?:key|secret|id|domain)|example\.com)/i;

function isPlaceholder(value: string | undefined) {
  return !value?.trim() || PLACEHOLDER_PATTERN.test(value);
}

function validateSecret(
  env: Environment,
  name: string,
  errors: string[],
  minimumLength = 1,
) {
  const value = env[name]?.trim();
  if (isPlaceholder(value) || (value?.length ?? 0) < minimumLength) {
    const lengthRequirement = minimumLength > 1
      ? ` with at least ${minimumLength} characters`
      : "";
    errors.push(`${name} must be a non-placeholder value${lengthRequirement}`);
  }
}

function validatePositiveIntegerId(env: Environment, name: string, errors: string[]) {
  const value = env[name]?.trim();
  if (isPlaceholder(value) || !/^[1-9]\d*$/.test(value ?? "")) {
    errors.push(`${name} must be a positive numeric ID`);
  }
}

function validateOrigin(
  env: Environment,
  name: string,
  errors: string[],
) {
  const value = env[name]?.trim();
  if (!value) {
    errors.push(`${name} is required`);
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(`${name} must use HTTPS`);
    }
    if (value !== url.origin) {
      errors.push(`${name} must be an origin without a path, query, hash, or trailing slash`);
    }
    return url.origin;
  } catch {
    errors.push(`${name} must be a valid URL`);
    return null;
  }
}

function validateDatabaseUrl(env: Environment, errors: string[]) {
  const value = env.DATABASE_URL?.trim();
  if (!value) {
    errors.push("DATABASE_URL is required");
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      errors.push("DATABASE_URL must use the postgresql:// or postgres:// protocol");
    }
  } catch {
    errors.push("DATABASE_URL must be a valid PostgreSQL URL");
  }
}

/**
 * Returns every production configuration problem at once so a deployment can be
 * corrected in one pass rather than failing later on the first exercised feature.
 */
export function getProductionEnvironmentErrors(env: Environment) {
  if (env.NODE_ENV !== "production") return [];

  const errors: string[] = [];
  validateDatabaseUrl(env, errors);
  validateSecret(env, "BETTER_AUTH_SECRET", errors, 32);
  validateSecret(env, "CRON_SECRET", errors, 32);

  const authOrigin = validateOrigin(env, "BETTER_AUTH_URL", errors);
  const appOrigin = validateOrigin(env, "NEXT_PUBLIC_APP_URL", errors);
  if (authOrigin && appOrigin && authOrigin !== appOrigin) {
    errors.push("BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL must use the same origin");
  }

  validateSecret(env, "RESEND_API_KEY", errors);
  const resendFrom = env.RESEND_FROM?.trim();
  if (isPlaceholder(resendFrom) || !resendFrom?.includes("@")) {
    errors.push("RESEND_FROM must be a non-placeholder sender email");
  }

  validateSecret(env, "STRIPE_SECRET_KEY", errors);
  validateSecret(env, "STRIPE_WEBHOOK_SECRET", errors);
  validateSecret(env, "MOYASAR_SECRET_KEY", errors);
  validateSecret(env, "PAYPAL_CLIENT_ID", errors);
  validateSecret(env, "PAYPAL_CLIENT_SECRET", errors);
  validateSecret(env, "PAYPAL_WEBHOOK_ID", errors);
  if (env.NEXT_PUBLIC_PADDLE_ENABLED !== "true" && env.NEXT_PUBLIC_PADDLE_ENABLED !== "false") {
    errors.push('NEXT_PUBLIC_PADDLE_ENABLED must be explicitly set to "true" or "false"');
  }
  if (env.NEXT_PUBLIC_LEMONSQUEEZY_ENABLED !== "true" && env.NEXT_PUBLIC_LEMONSQUEEZY_ENABLED !== "false") {
    errors.push('NEXT_PUBLIC_LEMONSQUEEZY_ENABLED must be explicitly set to "true" or "false"');
  }
  if (env.NEXT_PUBLIC_PADDLE_ENABLED === "true") {
    validateSecret(env, "PADDLE_API_KEY", errors);
    validateSecret(env, "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", errors);
    validateSecret(env, "PADDLE_WEBHOOK_SECRET", errors);
    validateSecret(env, "PADDLE_PRODUCT_ID", errors);
  }
  if (env.NEXT_PUBLIC_LEMONSQUEEZY_ENABLED === "true") {
    validateSecret(env, "LEMONSQUEEZY_API_KEY", errors);
    validateSecret(env, "LEMONSQUEEZY_WEBHOOK_SECRET", errors);
    validatePositiveIntegerId(env, "LEMONSQUEEZY_STORE_ID", errors);
    validatePositiveIntegerId(env, "LEMONSQUEEZY_VARIANT_ID", errors);
  }

  if (env.PAYPAL_MODE !== "sandbox" && env.PAYPAL_MODE !== "live") {
    errors.push('PAYPAL_MODE must be explicitly set to "sandbox" or "live"');
  }
  if (env.NEXT_PUBLIC_PADDLE_ENABLED === "true" && env.PADDLE_ENV !== "sandbox" && env.PADDLE_ENV !== "live") {
    errors.push('PADDLE_ENV must be explicitly set to "sandbox" or "live"');
  }
  if (
    env.NEXT_PUBLIC_LEMONSQUEEZY_ENABLED === "true" &&
    env.LEMONSQUEEZY_TEST_MODE !== "true" &&
    env.LEMONSQUEEZY_TEST_MODE !== "false"
  ) {
    errors.push('LEMONSQUEEZY_TEST_MODE must be explicitly set to "true" or "false"');
  }

  return errors;
}

export function assertProductionEnvironment(env: Environment = process.env) {
  const errors = getProductionEnvironmentErrors(env);
  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join("\n- ")}`);
  }
}
