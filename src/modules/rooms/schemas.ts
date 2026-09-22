import { z } from "zod";
import { isAvatarId, type AvatarId } from "../../shared/avatars.js";

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

const avatarId = z.custom<AvatarId>(isAvatarId, "Choose a valid avatar.");

export const roomMembershipSchema = z.object({ nickname, avatarId: avatarId.optional() }).strict();
export const roomCreationSchema = z
  .object({
    nickname,
    avatarId: avatarId.optional(),
    minPlayers: z.number().int().min(3).max(15).default(3),
    maxPlayers: z.number().int().min(3).max(15).default(12),
  })
  .strict()
  .refine((value) => value.minPlayers <= value.maxPlayers, {
    message: "Minimum players cannot exceed maximum players.",
    path: ["minPlayers"],
  });

export const roomSettingsSchema = z
  .object({
    selectedTaskPackId: z.uuid().nullable().optional(),
    taskPhaseSeconds: z.number().int().min(300).max(14400).optional(),
    meetingsPerPlayer: z.number().int().min(0).max(10).optional(),
    meetingDurationSeconds: z.number().int().min(30).max(1800).optional(),
    meetingVotingMode: z.enum(["timed", "all_voted"]).optional(),
    voteVisibility: z.enum(["private", "public"]).optional(),
    evidenceVisibility: z.enum(["private", "public"]).optional(),
    imposterMeetingTaskRequirement: z.enum(["none", "one"]).optional(),
    meetingCooldownSeconds: z.number().int().min(10).max(1800).optional(),
    imposterCooldownSeconds: z.number().int().min(10).max(300).optional(),
    imposterCount: z.number().int().min(1).max(7).optional(),
    taskCounts: z
      .object({
        easy: z.number().int().min(0).max(15),
        medium: z.number().int().min(0).max(15),
        hard: z.number().int().min(0).max(15),
      })
      .strict()
      .refine(
        (value) =>
          value.easy + value.medium + value.hard >= 1 &&
          value.easy + value.medium + value.hard <= 15,
        "Choose between 1 and 15 tasks per player.",
      )
      .optional(),
    roleCounts: z.record(z.string().min(1).max(50), z.number().int().min(0).max(15)).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one setting is required.");

export const emptyBodySchema = z.object({}).strict();
export type RoomMembershipInput = z.infer<typeof roomMembershipSchema>;
export type RoomCreationInput = z.infer<typeof roomCreationSchema>;
export type RoomSettingsInput = z.infer<typeof roomSettingsSchema>;
