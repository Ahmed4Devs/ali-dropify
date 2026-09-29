"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ownAvatarFilename } from "@/lib/avatar";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isSupportedShippingCountry, SAUDI_SHIPPING_COUNTRY } from "@/lib/shipping-destination";

const profileSchema = z.object({
  locale: z.enum(["en", "ar"]),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  phone: z.string().trim().max(30),
});

const addressSchema = z.object({
  id: z.string().optional(),
  locale: z.enum(["en", "ar"]),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
  country: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  street: z.string().trim().min(3).max(160),
  apartment: z.string().trim().max(100).optional(),
  zip: z.string().trim().min(2).max(20),
  isDefault: z.boolean(),
});

export async function updateProfileAction(input: z.input<typeof profileSchema>) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "accountInvalidProfile" as const };
  const session = await requireUser(parsed.data.locale);
  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        name: `${parsed.data.firstName} ${parsed.data.lastName}`,
        phone: parsed.data.phone,
      },
    });
    revalidatePath(`/${parsed.data.locale}/account`);
    return { ok: true as const, data: { id: user.id } };
  } catch {
    return { ok: false as const, error: "accountProfileUpdateFailed" as const };
  }
}

export async function saveAddressAction(input: z.input<typeof addressSchema>) {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "accountInvalidAddress" as const };
  if (!isSupportedShippingCountry(parsed.data.country)) {
    return { ok: false as const, error: "accountShippingCountryUnavailable" as const };
  }
  const session = await requireUser(parsed.data.locale);
  try {
    const addressData = {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      country: SAUDI_SHIPPING_COUNTRY,
      state: parsed.data.state,
      city: parsed.data.city,
      street: parsed.data.street,
      apartment: parsed.data.apartment,
      zip: parsed.data.zip,
      isDefault: parsed.data.isDefault,
    };
    const saved = await prisma.$transaction(async (transaction) => {
      if (parsed.data.isDefault) {
        await transaction.address.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
      }
      if (parsed.data.id) {
        return transaction.address.update({
          where: { id: parsed.data.id, userId: session.user.id },
          data: addressData,
        });
      }
      return transaction.address.create({ data: { ...addressData, userId: session.user.id } });
    });
    revalidatePath(`/${parsed.data.locale}/account`);
    return { ok: true as const, data: { id: saved.id } };
  } catch {
    return { ok: false as const, error: "accountAddressSaveFailed" as const };
  }
}

export async function deleteAddressAction(input: { id: string; locale: "en" | "ar" }) {
  const parsed = z.object({ id: z.string().min(1), locale: z.enum(["en", "ar"]) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "accountInvalidAddress" as const };
  const session = await requireUser(parsed.data.locale);
  try {
    await prisma.address.deleteMany({ where: { id: parsed.data.id, userId: session.user.id } });
    revalidatePath(`/${parsed.data.locale}/account`);
    return { ok: true as const, data: null };
  } catch {
    return { ok: false as const, error: "accountAddressDeleteFailed" as const };
  }
}

export async function uploadAvatarAction(locale: "en" | "ar", formData: FormData) {
  const parsed = z.object({
    locale: z.enum(["en", "ar"]),
    file: z.instanceof(File),
  }).safeParse({ locale, file: formData.get("avatar") });
  if (!parsed.success) return { ok: false as const, error: "accountAvatarRequired" as const };
  const file = parsed.data.file;
  if (file.size > 2 * 1024 * 1024) return { ok: false as const, error: "accountAvatarTooLarge" as const };
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
  const extension = extensions[file.type as keyof typeof extensions];
  if (!extension) return { ok: false as const, error: "accountAvatarType" as const };
  const session = await requireUser(locale);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!isJpeg && !isPng && !isWebp) return { ok: false as const, error: "accountAvatarInvalid" as const };
    const uploads = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploads, { recursive: true });
    const filename = `avatar-${session.user.id}-${randomUUID()}.${extension}`;
    await writeFile(path.join(uploads, filename), bytes, { flag: "wx" });
    const image = `/uploads/${filename}`;
    // Read the image being replaced from the database rather than from the session:
    // better-auth serves session.user.image from a 300s cookie cache that this write
    // does not refresh, so within that window it still holds the value from sign-in
    // and every replaced avatar would leak. Same transaction, so concurrent uploads
    // cannot both claim the same predecessor.
    const previousImage = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { image: true },
      });
      await tx.user.update({ where: { id: session.user.id }, data: { image } });
      return current?.image ?? null;
    });
    // Still validated: User.image is reachable through better-auth's /update-user, so
    // only a filename this action itself could have written for this user is unlinked.
    const previousName = ownAvatarFilename(previousImage, session.user.id);
    if (previousName) {
      await unlink(path.join(uploads, previousName)).catch(() => undefined);
    }
    revalidatePath(`/${locale}/account`);
    return { ok: true as const, data: { image } };
  } catch {
    return { ok: false as const, error: "accountAvatarUploadFailed" as const };
  }
}
