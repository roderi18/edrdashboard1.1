import * as z from 'zod';
import { schemaUtils } from 'src/components/hook-form';

export const DestSchema = z.object({
    avatarUrl: schemaUtils.file({ error: 'Avatar is required!' }),

    name: z.string().min(1, { error: 'Nombre requerido' }),
    destNumber: z.string().min(1, { error: 'Número requerido' }),

    coordinatorId: z.string().nullable(),

    country: z.string().min(1, { error: 'País requerido' }),

    churchId: z.object({ id: z.string() }).nullable().optional(),

    destMeetingTimes: z.string().optional(),

    status: z.string(),
    isVerified: z.boolean(),
});