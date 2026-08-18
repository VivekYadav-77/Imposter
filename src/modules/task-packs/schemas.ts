import { z } from "zod";

const description = z.string().trim().max(1000).nullable().optional();
const item = z
  .object({ description: z.string().trim().min(1).max(280), isActive: z.boolean().default(true) })
  .strict();
const items = z
  .array(
    z.union([
      z
        .string()
        .trim()
        .min(1)
        .max(280)
        .transform((value) => ({ description: value, isActive: true })),
      item,
    ]),
  )
  .max(15);

export const createPackSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description,
    items: items.default([]),
  })
  .strict();

export const updatePackSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    name: z.string().trim().min(1).max(80).optional(),
    description,
    items: items.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined || value.description !== undefined || value.items !== undefined,
    "At least one mutable field is required.",
  );

export const revisionSchema = z.object({ expectedRevision: z.number().int().positive() }).strict();
export const loginSchema = z
  .object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) })
  .strict();

export type CreatePackInput = z.output<typeof createPackSchema>;
export type UpdatePackInput = z.output<typeof updatePackSchema>;
