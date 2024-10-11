import { z } from "zod";

export const userStatusSchema = z.strictObject({
    status: z.string().max(70)
})