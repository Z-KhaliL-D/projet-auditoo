import { z } from "zod";
import { cursorSchema, idSchema } from "./fields";
import { levelSchema } from "./level";
import { opSchema } from "./op";
import { spaceSchema } from "./space";

export const pushRequestSchema = z.object({ ops: z.array(opSchema) });
export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResponseSchema = z.object({
  applied: z.array(idSchema),
  skipped: z.array(idSchema),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullResponseSchema = z.object({
  levels: z.array(levelSchema),
  spaces: z.array(spaceSchema),
  cursor: cursorSchema,
});
export type PullResponse = z.infer<typeof pullResponseSchema>;
