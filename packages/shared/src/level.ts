import { z } from "zod";
import { idSchema, nameSchema, rankSchema, timestampSchema } from "./fields";

export const levelSchema = z.object({
  id: idSchema,
  name: nameSchema,
  rank: rankSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
});

export type Level = z.infer<typeof levelSchema>;
