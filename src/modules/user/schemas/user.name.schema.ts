import { z } from "zod";
import { nameForSchema } from "src/utils/constants";

export const userNameSchema = z.strictObject({
    name: nameForSchema
})