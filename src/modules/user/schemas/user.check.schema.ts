import { z } from 'zod';
import { emailForSchema, loginForSchema, reservedLogins } from 'src/utils/constants';

export const userCheckSchema = z
    .discriminatedUnion('type', [
        z.object({
            type: z.literal('email'),
            email: emailForSchema,
        }),
        z.object({
            type: z.literal('login'),
            login: loginForSchema,
        }),
    ])
    .superRefine((data, ctx) => {
        data.type === 'login' && reservedLogins.includes(data.login) && ctx.addIssue({
            code: 'custom',
            message: `Sorry, "${data.login}" is reserved`,
            path: ['login'],
        });
    });