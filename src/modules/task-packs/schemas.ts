import { z } from "zod";

const description = z.string().trim().max(1000).nullable().optional();
const item = z
  .object({
    description: z.string().trim().min(1).max(280),
    isActive: z.boolean().default(true),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  })
  .strict();
const roles = z
  .array(
    z
      .object({
        name: z.string().trim().min(1).max(50),
        specialization: z.string().trim().min(1).max(160),
        ability: z.string().trim().min(1).max(200),
      })
      .strict(),
  )
  .max(12)
  .refine(
    (value) =>
      new Set(value.map((role) => role.name.toLocaleLowerCase("en-US"))).size === value.length,
    "Role names must be unique.",
  );
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
    roles: roles.default([]),
  })
  .strict();

export const updatePackSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    name: z.string().trim().min(1).max(80).optional(),
    description,
    items: items.optional(),
    roles: roles.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.items !== undefined ||
      value.roles !== undefined,
    "At least one mutable field is required.",
  );

export const revisionSchema = z.object({ expectedRevision: z.number().int().positive() }).strict();
export const loginSchema = z
  .object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) })
  .strict();

export type CreatePackInput = z.input<typeof createPackSchema>;
export type UpdatePackInput = z.input<typeof updatePackSchema>;
