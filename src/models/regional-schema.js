import * as z from 'zod';

export const RegionalSchema = z.object({
    regionId: z.union([z.string(), z.number()]).optional(),

    name: z
        .string()
        .min(1, { message: 'El nombre es requerido' })
        .refine((value) => !/\d/.test(value), {
            message: 'El nombre no debe contener números',
        }),

    countryId: z
        .union([z.string(), z.number()])
        .refine((val) => val !== '', {
            message: 'País es requerido',
        }),
});