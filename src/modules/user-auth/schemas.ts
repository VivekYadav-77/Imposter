import { z } from "zod";
import { isAvatarId, type AvatarId } from "../../shared/avatars.js";

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(12, "Password must contain at least 12 characters.").max(128);
const displayName = z.string().trim().min(1).max(24);
const avatarId = z.custom<AvatarId>(isAvatarId, "Choose a valid avatar.");

export const registerUserSchema = z.object({ email, password, displayName, avatarId }).strict();
export const loginUserSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const updateProfileSchema = z
  .object({ displayName: displayName.optional(), avatarId: avatarId.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required.");
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();
export const confirmPasswordSchema = z.object({ password: z.string().min(1).max(128) }).strict();
