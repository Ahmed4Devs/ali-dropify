import "server-only";

import { randomBytes } from "node:crypto";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
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
