import * as z from 'zod';

export const ChurchSchema = z.object({
    churchName: z.string().min(1, { error: 'Nombre requerido' }),

    pastor: z.string().optional(),
    address: z.string().optional(),
    provinceId: z.string().optional(),
    countryId: z.string().optional(),
    provinceId: z.string().optional(),
    municipioId: z.string().optional(),
    sectorId: z.string().optional(),
    street: z.string().optional(),
    correo: z
        .string()
        .email('Correo inválido')
        .optional()
        .or(z.literal('')),

    // ID real de la sección (lo que terminará como idSeccion en el payload API)
    sectionId: z.string().min(1, { error: 'Sección requerida' }),

    // Se mantiene para UI/etiqueta, pero NO debe ser la fuente del ID
    sectionalName: z.string().optional(),
});