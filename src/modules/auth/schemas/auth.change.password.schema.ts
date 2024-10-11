import { z } from 'zod';
import { passwordForSchema } from 'src/utils/constants';

export const authChangePasswordSchema = z
    .strictObject({
        type: z.enum(['set', 'check']),
        currentPassword: passwordForSchema.optional(),
        newPassword: passwordForSchema.optional(),
    })
    .superRefine(({ type, currentPassword, newPassword }, ctx) => {
        const actions: Record<typeof type, () => void> = {
            set: () => {
                (!currentPassword || !newPassword) && ctx.addIssue({
                    code: 'custom',
                    message: 'Please provide current and new password',
                    path: ['currentPassword', 'newPassword'],
                });
            },
            check: () => {
                !currentPassword && ctx.addIssue({
                    code: 'custom',
                    message: 'Please provide current password',
                    path: ['currentPassword'],
                });
            },
        };

        actions[type]();
    });