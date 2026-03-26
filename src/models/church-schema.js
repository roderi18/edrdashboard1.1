import * as z from 'zod';

export const ChurchSchema = z.object({
    churchName: z.string().min(1, { error: 'Nombre requerido' }),

    pastor: z.string().optional(),
    address: z.string().optional(),
    provinceId: z.string().optional(),
    countryId: z.string().optional(),
    sectionalName: z.string().optional(),
});