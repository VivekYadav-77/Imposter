import { z } from "zod";

export const startGameSchema = z.object({}).strict();

export const killSchema = z
  .object({
    expectedStateVersion: z.number().int().positive(),
    targetParticipantId: z.string().uuid(),
  })
  .strict();

export const callMeetingSchema = z
  .object({ expectedStateVersion: z.number().int().positive() })
  .strict();

export const reviewVoteSchema = z
  .object({
    expectedStateVersion: z.number().int().positive(),
    decision: z.enum(["valid", "invalid"]),
  })
  .strict();

export const ejectionVoteSchema = z
  .object({
    expectedStateVersion: z.number().int().positive(),
    targetParticipantId: z.string().uuid().nullable(),
  })
  .strict();

export type KillInput = z.infer<typeof killSchema>;
export type CallMeetingInput = z.infer<typeof callMeetingSchema>;
export type ReviewVoteInput = z.infer<typeof reviewVoteSchema>;
export type EjectionVoteInput = z.infer<typeof ejectionVoteSchema>;
