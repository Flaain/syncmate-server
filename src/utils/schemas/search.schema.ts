import { z } from 'zod';
import { nameForSchema } from '../constants';

export const searchSchema = z.strictObject({
    query: nameForSchema.trim().min(3, 'Search query must be at least 3 characters long'),
    page: z.number({ coerce: true }).min(0).default(0),
    limit: z.number({ coerce: true }).min(1, 'Limit must be between 1 and 10').max(10, 'Limit must be between 1 and 10').default(10),
});