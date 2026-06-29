import * as z from 'zod';

export const DestSchema = z.object({
    avatarUrl: z.any().optional().nullable(),

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

    // Campos de la iglesia editables desde el form de destacamento.
    // Deben declararse aquí o zod los elimina del payload al guardar.
    pastor: z.string().optional(),
    provinceId: z.string().optional(),
    municipioId: z.string().optional(),
    sectorId: z.string().optional(),
    street: z.string().optional(),
    address: z.string().optional(),
    direccion: z.string().optional(),
    sectionId: z.string().optional(),
});
