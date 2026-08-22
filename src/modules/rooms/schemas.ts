import { z } from "zod";

function displayNickname(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeNickname(value: string): { display: string; normalized: string } {
  const display = displayNickname(value);
  return { display, normalized: display.toLocaleLowerCase("en-US") };
}

const nickname = z
  .string()
  .transform(displayNickname)
  .refine(
    (value) => Array.from(value).length >= 1 && Array.from(value).length <= 24,
    "Nickname must contain 1 to 24 characters.",
  )
  .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), "Nickname cannot contain control characters.");

export const roomMembershipSchema = z.object({ nickname }).strict();

export const roomSettingsSchema = z
  .object({
    selectedTaskPackId: z.uuid().nullable().optional(),
    taskPhaseSeconds: z.number().int().min(300).max(3600).optional(),
    discussionSeconds: z.number().int().min(30).max(300).optional(),
    reviewSeconds: z.number().int().min(30).max(180).optional(),
    votingSeconds: z.number().int().min(30).max(180).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one setting is required.");

export const emptyBodySchema = z.object({}).strict();
export type RoomMembershipInput = z.infer<typeof roomMembershipSchema>;
export type RoomSettingsInput = z.infer<typeof roomSettingsSchema>;
