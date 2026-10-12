import { z } from "zod";
import { idSchema, nameSchema, rankSchema, timestampSchema } from "./fields";

const base = {
  opId: idSchema,
  createdAt: timestampSchema,
};

export const opSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("level.create"),
    payload: z.object({ id: idSchema, name: nameSchema, rank: rankSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("level.rename"),
    payload: z.object({ id: idSchema, name: nameSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("level.move"),
    payload: z.object({ id: idSchema, rank: rankSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("level.delete"),
    payload: z.object({ id: idSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("level.restore"),
    payload: z.object({ id: idSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("space.create"),
    payload: z.object({
      id: idSchema,
      levelId: idSchema,
      name: nameSchema,
      rank: rankSchema,
    }),
  }),
  z.object({
    ...base,
    type: z.literal("space.rename"),
    payload: z.object({ id: idSchema, name: nameSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("space.move"),
    payload: z.object({ id: idSchema, levelId: idSchema, rank: rankSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("space.delete"),
    payload: z.object({ id: idSchema }),
  }),
  z.object({
    ...base,
    type: z.literal("space.restore"),
    payload: z.object({ id: idSchema }),
  }),
]);

export type Op = z.infer<typeof opSchema>;
