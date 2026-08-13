import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { assertProductionAuthConfiguration, auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  try {
    assertProductionAuthConfiguration();
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
}

export async function requireUser(locale = "en") {
  const session = await getSession();
  if (!session) redirect(`/${locale}/sign-in`);
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) notFound();

  const activeSession = await prisma.session.findUnique({
    where: { token: session.session.token },
    select: {
      expiresAt: true,
      user: { select: { role: true } },
    },
  });

  if (
    !activeSession ||
    activeSession.expiresAt <= new Date() ||
    activeSession.user.role !== "ADMIN"
  ) {
    notFound();
  }

  return {
    ...session,
    user: { ...session.user, role: activeSession.user.role },
  };
}
