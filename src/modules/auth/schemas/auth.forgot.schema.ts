import { emailForSchema } from "src/utils/constants";
import { z } from "zod";

export const forgotSchema = z.strictObject({
    email: emailForSchema
})