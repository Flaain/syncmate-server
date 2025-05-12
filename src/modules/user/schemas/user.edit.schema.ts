import { nameForSchema } from 'src/utils/constants';
import { z } from 'zod';

export const userEditSchema = z.strictObject({
    name: nameForSchema,
    lastName: z.string().trim().max(32, 'Last Name must be at most 32 characters long'),
    bio: z.string().trim().max(120, 'Bio must be at most 32 characters long'),
});