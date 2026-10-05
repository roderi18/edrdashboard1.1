// ----------------------------------------------------------------------
// ENVÍOS REPETIDOS EN LA BANDEJA DE ACTUALIZACIONES.
//
// Un mismo destacamento puede mandar el formulario varias veces (Apache 206 lo
// mandó dos, y con el coordinador escrito distinto). En la bandeja no se veía
// y se podían cargar los dos. Cada fila dice cuántas VECES MÁS llegó su
// destacamento: con dos envíos, los dos dicen "Repetido x1".
// ----------------------------------------------------------------------

const normalizar = (valor) =>
  String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A qué destacamento pertenece un envío: su id o, si es nuevo, nombre y número. */
export const claveDeDestacamento = (fila = {}) => {
  const id = fila.destacamento?.id;
  if (id != null && String(id) !== '') return `id:${id}`;
  const nombre = normalizar(fila.nombreDestacamento || fila.destacamento?.nombre);
  const numero = normalizar(fila.numeroDestacamento || fila.destacamento?.numero);
  return nombre || numero ? `nuevo:${nombre}#${numero}` : `envio:${fila.id}`;
};

/** { idDelEnvío: veces que se repite } solo para los que llegaron más de una vez. */
export function repeticionesPorEnvio(filas = []) {
  const grupos = new Map();
  for (const fila of filas) {
    const clave = claveDeDestacamento(fila);
    grupos.set(clave, [...(grupos.get(clave) || []), fila.id]);
  }
  const veces = {};
  for (const ids of grupos.values()) {
    if (ids.length > 1) ids.forEach((id) => (veces[id] = ids.length - 1));
  }
  return veces;
}

export const textoRepetido = (veces) => (veces > 0 ? `Repetido x${veces}` : '');
