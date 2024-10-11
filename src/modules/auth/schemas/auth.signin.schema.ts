import { z } from 'zod';

export const signinSchema = z.object({
    login: z
        .string()
        .trim()
        .min(3, 'Field must be at least 3 characters long')
        .max(32, 'Field must be at most 32 characters long')
        .toLowerCase(),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters long')
        .max(32, 'Password must be at most 32 characters long'),
});