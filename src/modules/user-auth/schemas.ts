import { z } from "zod";
import { isAvatarId, type AvatarId } from "../../shared/avatars.js";

const displayName = z.string().trim().min(1).max(24);
const avatarId = z.custom<AvatarId>(isAvatarId, "Choose a valid avatar.");

export const updateProfileSchema = z
  .object({ displayName: displayName.optional(), avatarId: avatarId.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required.");

export const mobileGoogleChallengeSchema = z
  .object({ intent: z.enum(["login", "play", "post_game", "delete"]) })
  .strict();

export const mobileGoogleCompleteSchema = z
  .object({
    transactionToken: z.string().min(32).max(512),
    idToken: z.string().min(100).max(16_384),
  })
  .strict();
