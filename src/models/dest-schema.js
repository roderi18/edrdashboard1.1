import * as z from 'zod';
import { schemaUtils } from 'src/components/hook-form';

export const DestSchema = z.object({
    avatarUrl: schemaUtils.file().optional(),

    churchName: z.string().optional(),

    name: z.string().optional(),
    destNumber: z.string().optional(),

    coordinatorId: z.string().nullable(),

    destMeetingDays: z.string().optional(),
    destMeetingTimes: z.string().optional(),

    correo: z
        .string()
        .email('Correo inválido')
        .optional()
        .or(z.literal('')),

    telefono: z.string().optional(),

    registradoOfnc: z.boolean().optional(),
    rritrackActivo: z.boolean().optional(),

    isVerified: z.boolean(),
    churchId: z.string().min(1, { error: 'Iglesia requerida' }),
});