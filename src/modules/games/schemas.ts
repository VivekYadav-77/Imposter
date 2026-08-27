import { z } from "zod";

export const startGameSchema = z.object({}).strict();
export const developmentCompleteTaskSchema = z
  .object({ expectedStateVersion: z.number().int().positive() })
  .strict();
