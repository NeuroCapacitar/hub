export const USER_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const USER_AVATAR_SIZE = 512;
export const USER_AVATAR_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const USER_AVATAR_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
