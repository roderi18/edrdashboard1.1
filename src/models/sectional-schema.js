import * as z from 'zod';

export const SectionalCreateSchema = z.object({
    sectionalName: z
        .string()
        .min(1, 'Debe ingresar el nombre de la Sección'),

    // Opcional: el apodo de la seccion. No lo guarda la API sino Firebase, pero
    // tiene que estar declarado o el resolver lo descartaria antes de llegar al
    // guardado.
    sectionalName2: z.string().optional(),

    regionalId: z
        .string()
        .min(1, 'Debe seleccionar una región'),
});