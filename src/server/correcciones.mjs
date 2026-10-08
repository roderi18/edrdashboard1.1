// ----------------------------------------------------------------------
// "CORREGIR DATOS" (paso 1): la persona dice que algún dato del destacamento
// no es correcto y escribe el bueno. Lo que cambió se guarda en la membresía
// como { campo: { antes, despues } } y el pago queda EN REVISIÓN: ni la
// transferencia ni PayPal activan la membresía hasta que la Oficina Nacional
// confirme los cambios. El padrón no se toca desde aquí.
// ----------------------------------------------------------------------

export const CAMPOS_CORREGIBLES = Object.freeze({
  numero: 'Número oficial',
  nombre: 'Nombre',
  region: 'Región',
  seccion: 'Sección',
  iglesia: 'Iglesia',
  coordinador: 'Coordinador(a)',
  pastor: 'Pastor(a) o pareja pastoral',
});

const limpiar = (v) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

// `entrada`: lo que manda el navegador ({ campo: valor } o JSON de eso).
// Devuelve solo los campos permitidos que de verdad cambian.
export function sanearCorrecciones(entrada, destacamento) {
  let datos = entrada;
  if (typeof datos === 'string') {
    try {
      datos = JSON.parse(datos || '{}');
    } catch {
      datos = {};
    }
  }
  if (!datos || typeof datos !== 'object') return {};
  const resultado = {};
  Object.keys(CAMPOS_CORREGIBLES).forEach((campo) => {
    if (!(campo in datos)) return;
    const despues = limpiar(datos[campo]);
    const antes = limpiar(destacamento?.[campo]);
    if (despues !== antes) resultado[campo] = { antes, despues };
  });
  return resultado;
}

export const hayCorrecciones = (correcciones) => Object.keys(correcciones || {}).length > 0;

// "Nombre: «A» → «B»; Pastor(a): «» → «C»" para correos y avisos.
export const describirCorrecciones = (correcciones) =>
  Object.entries(correcciones || {})
    .map(
      ([campo, { antes, despues }]) =>
        `${CAMPOS_CORREGIBLES[campo] || campo}: «${antes || '—'}» → «${despues || '—'}»`
    )
    .join('; ');

// Quién hizo la corrección: nombre (de la lista de miembros o escrito),
// su id de miembro si se eligió de la lista y su teléfono.
export function sanearCorregidoPor(entrada) {
  let datos = entrada;
  if (typeof datos === 'string') {
    try {
      datos = JSON.parse(datos || 'null');
    } catch {
      datos = null;
    }
  }
  if (!datos || typeof datos !== 'object') return null;
  const nombre = limpiar(datos.nombre);
  const telefono = String(datos.telefono ?? '')
    .replace(/[^\d+()\s-]/g, '')
    .trim()
    .slice(0, 20);
  const idMiembro = /^\d{1,12}$/.test(String(datos.idMiembro || '')) ? String(datos.idMiembro) : '';
  return nombre.length >= 3 ? { nombre, telefono, idMiembro } : null;
}
