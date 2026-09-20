import "server-only";

import { randomBytes } from "node:crypto";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { isManagedAvatarPath } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const configuredSecret = process.env.BETTER_AUTH_SECRET;
const secret = configuredSecret ?? randomBytes(32).toString("hex");

export function assertProductionAuthConfiguration() {
  if (process.env.NODE_ENV !== "production") return;
  if (!configuredSecret || configuredSecret.includes("dummy") || configuredSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be a non-dummy secret of at least 32 characters in production");
  }
  if (!baseURL.startsWith("https://")) {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production");
  }
}

export const auth = betterAuth({
  appName: "Store",
  baseURL,
  secret,
  trustedOrigins: [baseURL, process.env.NEXT_PUBLIC_APP_URL ?? baseURL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    user: {
      update: {
        // User.image is only ever written by uploadAvatarAction, which goes through
        // Prisma directly and so bypasses these hooks. Anything reaching here came
        // from a client calling better-auth's /update-user, which takes `image` as
        // free text — and that value is later used to pick a file to delete.
        //
        // Strip the field rather than returning false: a rejected update makes
        // /update-user fall back to echoing the client's own payload into the
        // session cookie, which would leave the hostile value on session.user.image
        // anyway. An undefined field is skipped by the adapter, so the stored image
        // survives untouched and the refreshed cookie carries the real one.
        async before(user) {
          const { image } = user;
          if (image === undefined || image === null) return;
          if (isManagedAvatarPath(image)) return;
          return { data: { image: undefined } };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    async sendVerificationEmail({ user, url }) {
      await sendMail(
        user.email,
        "Verify your email",
        `Welcome to our store. Verify your email address: ${url}`,
      );
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      phone: { type: "string", required: false, input: true },
      role: {
        type: ["CUSTOMER", "ADMIN"],
        required: true,
        defaultValue: "CUSTOMER",
        input: false,
      },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 300 },
  },
  // Brute-force protection for the auth endpoints. Counters live in the database so
  // they hold across serverless instances instead of per-process memory. better-auth
  // only enables rate limiting in production, so local development stays unthrottled.
  rateLimit: {
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 300, max: 5 },
      "/sign-in/email-otp": { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 300, max: 3 },
    },
  },
  experimental: { joins: true },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        await sendMail(email, `Your ${type} code`, `Your code is ${otp}`);
      },
    }),
    nextCookies(),
  ],
});
