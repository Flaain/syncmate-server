import { z } from 'zod';
import { emailForSchema, loginForSchema, reservedLogins } from 'src/utils/constants';

export const userCheckSchema = z
    .strictObject({
        type: z.enum(['email', 'login']),
        email: emailForSchema.optional(),
        login: loginForSchema.optional(),
    })
    .superRefine(({ type, email, login }, ctx) => {
        const actions: Record<typeof type, () => void> = {
            email: () => {
                !email && ctx.addIssue({
                    code: 'custom',
                    message: 'Please provide email',
                    path: ['email'],
                });
            },
            login: () => {
                if (!login) {
                    ctx.addIssue({
                        code: 'custom',
                        message: 'Please provide login',
                        path: ['login'],
                        fatal: true,
                    });

                    return z.NEVER;
                }

                reservedLogins.includes(login) && ctx.addIssue({
                    code: 'custom',
                    message: 'Sorry this login is reserved',
                    path: ['login'],
                });
            },
        };

        actions[type]();
    });