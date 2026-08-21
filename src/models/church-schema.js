import * as z from 'zod';

// Campo obligatorio de texto.
//
// El mensaje se pone TAMBIEN a nivel de `z.string()`, no solo en el `min(1)`:
// los campos que nunca se han tocado llegan como `undefined`, no como cadena
// vacia, y entonces falla la comprobacion de tipo antes que la de longitud. Sin
// esto el usuario veia "Invalid input: expected string, received undefined".
const requerido = (mensaje) => z.string({ error: mensaje }).trim().min(1, { error: mensaje });

export const ChurchSchema = z.object({
    churchName: requerido('Nombre requerido'),

    pastor: requerido('Pastor requerido'),
    address: z.string().optional(),

    // La direccion es OBLIGATORIA al dar de alta la iglesia.
    //
    // Antes era opcional y el payload la sustituia por el literal "Dirección no
    // especificada". Resultado: 61 de las 67 iglesias quedaron sin direccion
    // real, y como de la provincia sale el codigo del miembro, tampoco se les
    // puede generar uno. El dato inventado no se ve hasta que hace falta, y para
    // entonces ya es tarde.
    countryId: z.string().optional(),
    provinceId: requerido('Provincia requerida'),
    municipioId: requerido('Municipio requerido'),
    sectorId: requerido('Sector requerido'),
    street: requerido('Calle / Número requerido'),

    telefono: z.string().optional(),
    correo: z
        .string()
        .email('Correo inválido')
        .optional()
        .or(z.literal('')),

    // ID real de la sección (lo que terminará como idSeccion en el payload API)
    sectionId: requerido('Sección requerida'),

    // Se mantiene para UI/etiqueta, pero NO debe ser la fuente del ID
    sectionalName: z.string().optional(),
});
