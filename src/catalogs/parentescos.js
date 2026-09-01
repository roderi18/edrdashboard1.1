// ----------------------------------------------------------------------
// LA RELACION CON EL MIEMBRO.
//
// Un solo catalogo para toda la aplicacion. Lo usan el contacto de la Dispensa
// Medica y los tutores de la pestaña de Padres, y tiene que ser el MISMO: si un
// sitio dice "Tutor" y el otro "Tutor legal", acaban siendo dos cosas distintas
// para la base de datos y nadie sabe cual mirar.
//
// Vivia dentro de `_mock/health.js`, que es donde la plantilla deja los datos de
// ejemplo. Esto no es un dato de ejemplo: es el catalogo de verdad, y ahora que
// lo usan dos pantallas le corresponde su sitio.
//
// El valor guardado es la CLAVE (`mother`, `father`…), no la etiqueta: cambiar
// como se lee en pantalla no puede cambiar lo que ya esta guardado.
//
// `other` va el ultimo a proposito: es el cajon de sastre, y en una lista de
// opciones el cajon de sastre siempre va al final.
// ----------------------------------------------------------------------

export const PARENTESCOS = [
  { value: 'mother', label: 'Madre' },
  { value: 'father', label: 'Padre' },
  { value: 'guardian', label: 'Tutor' },
  { value: 'grandparent', label: 'Abuelo/a' },
  { value: 'uncle_aunt', label: 'Tío/a' },
  { value: 'sibling', label: 'Hermano/a' },
  { value: 'spouse', label: 'Cónyuge' },
  { value: 'other', label: 'Otro' },
];

/** Como se lee en pantalla. Si no esta en la lista, se devuelve lo guardado. */
export const etiquetaDeParentesco = (valor) =>
  PARENTESCOS.find((opcion) => opcion.value === valor)?.label ?? String(valor ?? '');
