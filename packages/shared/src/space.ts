import { z } from "zod";
import { levelSchema } from "./level";
import { idSchema } from "./fields";

export const spaceSchema = levelSchema.extend({
  levelId: idSchema,
});

export type Space = z.infer<typeof spaceSchema>;
