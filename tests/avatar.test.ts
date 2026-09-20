import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { isManagedAvatarPath, ownAvatarFilename } from "../lib/avatar";

const userId = "attacker123";
const uuid = "0f9d4e21-6c3a-4b5d-8e77-1a2b3c4d5e6f";
const own = `/uploads/avatar-${userId}-${uuid}.png`;

test("accepts the caller's own avatar", () => {
  assert.equal(ownAvatarFilename(own, userId), `avatar-${userId}-${uuid}.png`);
  for (const ext of ["jpg", "png", "webp"]) {
    assert.ok(ownAvatarFilename(`/uploads/avatar-${userId}-${uuid}.${ext}`, userId));
  }
});

test("accepts user ids containing dashes", () => {
  const seeded = "seed-user-admin";
  assert.equal(
    ownAvatarFilename(`/uploads/avatar-${seeded}-${uuid}.webp`, seeded),
    `avatar-${seeded}-${uuid}.webp`,
  );
});

test("rejects traversal that stays inside the uploads directory", () => {
  // The pre-fix guard resolved these inside public/uploads and deleted them.
  assert.equal(ownAvatarFilename(`/uploads/avatar-${userId}-/../product-photo.png`, userId), null);
  assert.equal(ownAvatarFilename(`/uploads/avatar-${userId}-/../avatar-victim-${uuid}.png`, userId), null);
  assert.equal(ownAvatarFilename(`/uploads/avatar-${userId}-/..\product-photo.png`, userId), null);
  assert.equal(ownAvatarFilename(`/uploads/avatar-${userId}-/subdir/x.png`, userId), null);
});

test("rejects traversal that escapes the uploads directory", () => {
  assert.equal(ownAvatarFilename(`/uploads/avatar-${userId}-/../../logo.png`, userId), null);
  assert.equal(ownAvatarFilename(`/uploads/../../../etc/passwd`, userId), null);
});

test("rejects another user's avatar", () => {
  assert.equal(ownAvatarFilename(`/uploads/avatar-victim999-${uuid}.png`, userId), null);
  // Prefix-confusion: victim id that starts with the attacker id.
  assert.equal(ownAvatarFilename(`/uploads/avatar-${userId}9-${uuid}.png`, userId), null);
});

test("rejects non-avatar and malformed values", () => {
  for (const value of [
    null,
    undefined,
    "",
    "/uploads/",
    "/uploads/product-photo.png",
    `/uploads/avatar-${userId}-notauuid.png`,
    `/uploads/avatar-${userId}-${uuid}.svg`,
    `/uploads/avatar-${userId}-${uuid}.png.exe`,
    `https://evil.example/avatar-${userId}-${uuid}.png`,
    `/UPLOADS/avatar-${userId}-${uuid}.png`,
  ]) {
    assert.equal(ownAvatarFilename(value as string | null | undefined, userId), null, `expected null for ${String(value)}`);
  }
});

test("an accepted filename always resolves to a direct child of uploads", () => {
  const uploads = path.resolve("/srv/app/public/uploads");
  const filename = ownAvatarFilename(own, userId);
  assert.ok(filename);
  assert.equal(path.dirname(path.join(uploads, filename)), uploads);
});

test("isManagedAvatarPath gates client-supplied image values", () => {
  assert.ok(isManagedAvatarPath(own));
  assert.ok(isManagedAvatarPath(`/uploads/avatar-seed-user-admin-${uuid}.jpg`));
  for (const value of [
    `/uploads/avatar-${userId}-/../product-photo.png`,
    "/uploads/product-photo.png",
    "https://evil.example/pixel.gif",
    "javascript:alert(1)",
    "",
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(isManagedAvatarPath(value), false, `expected false for ${String(value)}`);
  }
});
