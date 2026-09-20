const AVATAR_DIRECTORY = "/uploads/";

// The exact shape uploadAvatarAction writes: `avatar-<userId>-<uuid>.<ext>`.
// The user id is not pinned here because it may itself contain "-" (seeded ids do),
// so callers that know the id check the prefix separately.
const AVATAR_SUFFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

// Same shape, with any user id in the middle. `.+` cannot span segments because
// avatarFilename() has already rejected separators.
const MANAGED_AVATAR =
  /^avatar-.+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

function avatarFilename(image: string) {
  if (!image.startsWith(AVATAR_DIRECTORY)) return null;
  const filename = image.slice(AVATAR_DIRECTORY.length);
  // A single path segment only. Rejecting separators outright is what makes the
  // value safe to join onto the uploads root: `avatar-<id>-/../other.png` passes a
  // "resolves inside uploads" check but escapes the intended file.
  if (filename.includes("/") || filename.includes("\\")) return null;
  return filename;
}

/**
 * Returns the caller's own avatar filename, or null when `image` is anything else.
 * Used to decide which file a user is allowed to delete.
 */
export function ownAvatarFilename(
  image: string | null | undefined,
  userId: string,
) {
  if (!image) return null;
  const filename = avatarFilename(image);
  if (!filename) return null;
  const prefix = `avatar-${userId}-`;
  if (!filename.startsWith(prefix)) return null;
  return AVATAR_SUFFIX.test(filename.slice(prefix.length)) ? filename : null;
}

/**
 * Whether `image` is a path this app could have produced for some user.
 * Used to reject client-supplied values that never came from an upload.
 */
export function isManagedAvatarPath(image: unknown) {
  if (typeof image !== "string") return false;
  const filename = avatarFilename(image);
  return filename !== null && MANAGED_AVATAR.test(filename);
}
