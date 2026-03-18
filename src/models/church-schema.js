import * as z from 'zod';

export const ChurchSchema = z.object({
    churchName: z.string().min(1, { error: 'Nombre requerido' }),

    pastor: z.string().min(1, { error: 'Pastor requerido' }),

    address: z.string().min(1, { error: 'Dirección requerida' }),

    provinceId: z.string().min(1, { error: 'Provincia requerida' }),

    countryId: z.string().min(1, { error: 'País requerido' }),

    sectionId: z.string().min(1, { error: 'Sección requerida' }),
});