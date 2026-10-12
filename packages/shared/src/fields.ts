import { z } from "zod";

export const idSchema = z.uuid();
export const nameSchema = z.string().trim().min(1).max(80);
export const rankSchema = z.string().min(1);
export const timestampSchema = z.number().int().nonnegative();
export const cursorSchema = z.number().int().nonnegative();
