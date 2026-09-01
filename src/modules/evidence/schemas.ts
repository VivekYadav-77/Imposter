import { z } from "zod";

export const uploadIntentSchema = z
  .object({
    expectedStateVersion: z.number().int().positive(),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
    checksum: z
      .string()
      .regex(/^[A-Za-z0-9+/]{43}=$/)
      .nullable()
      .optional(),
  })
  .strict();

export const confirmSubmissionSchema = z
  .object({
    expectedStateVersion: z.number().int().positive(),
    uploadId: z.string().uuid(),
  })
  .strict();

export const flagSubmissionSchema = z
  .object({
    expectedStateVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(280).nullable().optional(),
  })
  .strict();

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;
export type ConfirmSubmissionInput = z.infer<typeof confirmSubmissionSchema>;
export type FlagSubmissionInput = z.infer<typeof flagSubmissionSchema>;
