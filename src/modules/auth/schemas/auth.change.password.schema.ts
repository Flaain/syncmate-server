import { z } from 'zod';
import { passwordForSchema } from 'src/utils/constants';

export const authChangePasswordSchema = z.discriminatedUnion('type', [
    z.strictObject({
        type: z.literal('set'),
        currentPassword: passwordForSchema,
        newPassword: passwordForSchema,
    }),
    z.strictObject({
        type: z.literal('check'),
        currentPassword: passwordForSchema,
    }),
]);