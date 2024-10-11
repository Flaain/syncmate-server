import { z } from 'zod';
import { loginForSchema, nameForSchema } from 'src/utils/constants';
import { isValidObjectId } from 'mongoose';

export const createGroupSchema = z
    .strictObject({
        login: loginForSchema,
        name: nameForSchema,
        participants: z
            .array(z.string().min(1, 'Participant id is required').max(24, 'Participant id is invalid'))
            .max(9, 'Maximum 10 participants are allowed including yourself')
            .optional(),
    })
    .superRefine(({ participants }, ctx) => {
        participants.length && participants.forEach((participant) => {
            !isValidObjectId(participant) && ctx.addIssue({
                code: 'custom',
                message: `Participant id (${participant}) is invalid`,
            });
        });
    });