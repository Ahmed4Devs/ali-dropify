"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { assertProductionAuthConfiguration, auth } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";

const signUpSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.email(),
  password: z.string().min(8).max(128),
});

const passwordSignInSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

const emailSchema = z.object({ email: z.email() });
const otpSchema = emailSchema.extend({ otp: z.string().regex(/^\d{6}$/) });

export async function signUpAction(input: z.input<typeof signUpSchema>) {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "authInvalidSignUp" as const };
  }

  try {
    assertProductionAuthConfiguration();
    const data = await auth.api.signUpEmail({
      body: {
        name: `${parsed.data.firstName} ${parsed.data.lastName}`,
        email: parsed.data.email,
        password: parsed.data.password,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      },
    });
    return { ok: true as const, data: { email: data.user.email } };
  } catch {
    return { ok: false as const, error: "authSignUpFailed" as const };
  }
}

export async function passwordSignInAction(
  input: z.input<typeof passwordSignInSchema>,
) {
  const parsed = passwordSignInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "authInvalidCredentials" as const };
  }

  try {
    assertProductionAuthConfiguration();
    const data = await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
    await mergeGuestCart(data.user.id);
    return { ok: true as const, data: { userId: data.user.id } };
  } catch {
    return { ok: false as const, error: "authInvalidCredentials" as const };
  }
}

export async function sendSignInCodeAction(input: z.input<typeof emailSchema>) {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "authInvalidEmail" as const };

  try {
    assertProductionAuthConfiguration();
    await auth.api.sendVerificationOTP({
      body: { email: parsed.data.email, type: "sign-in" },
    });
    return { ok: true as const, data: { email: parsed.data.email } };
  } catch {
    return { ok: false as const, error: "authCodeSendFailed" as const };
  }
}

export async function verifySignInCodeAction(input: z.input<typeof otpSchema>) {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "authInvalidCode" as const };

  try {
    assertProductionAuthConfiguration();
    const data = await auth.api.signInEmailOTP({
      body: { email: parsed.data.email, otp: parsed.data.otp },
      headers: await headers(),
    });
    await mergeGuestCart(data.user.id);
    return { ok: true as const, data: { userId: data.user.id } };
  } catch {
    return { ok: false as const, error: "authInvalidCode" as const };
  }
}

export async function signOutAction() {
  try {
    assertProductionAuthConfiguration();
    await auth.api.signOut({ headers: await headers() });
    return { ok: true as const, data: null };
  } catch {
    return { ok: false as const, error: "authSignOutFailed" as const };
  }
}
