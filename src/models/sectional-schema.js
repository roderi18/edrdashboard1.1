import * as z from 'zod';

export const SectionalCreateSchema = z.object({

    sectionalName: z
        .string()
        .min(1, 'Debe ingresar el nombre de la Sección'),

    regionalId: z
        .string()
        .min(1, 'Debe seleccionar una región'),

    status: z
        .enum(['active', 'banned'])
        .default('active'),

    directorId: z.string().optional(),
});