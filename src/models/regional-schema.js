import * as z from 'zod';

export const RegionalSchema = z.object({
    regionId: z.string().min(1, { message: 'regionId es requerido' }),

    name: z.string().min(1, { message: 'El nombre es requerido' }),

    countryId: z
        .union([z.string(), z.number()])
        .refine((val) => val !== '', {
            message: 'countryId es requerido',
        }),
});