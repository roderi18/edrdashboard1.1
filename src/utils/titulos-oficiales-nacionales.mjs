// ----------------------------------------------------------------------
// TÍTULOS DE LOS OFICIALES DE LA NACIONAL (tarjeta "Oficiales Especiales").
//
// Cada Oficial de la Nacional lleva como mucho UN título (Protocolo, Diseño y
// artes…), y un mismo título lo pueden llevar VARIAS personas, sin límite: una
// comisión o un comité son un grupo ("Asignar miembros" da el mismo título a
// varios a la vez). Antes cada título era de una sola persona y los ocupados
// salían deshabilitados; se cambió a petición. El título es de la persona, no
// de la casilla: se guarda por `idMiembros`.
//
// Todo vive en un único documento (`titulos_oficiales_nacionales/actual`), que
// se escribe en transacción para no pisar lo que otro guardó a la vez:
//   { adicionales: ['…'], asignaciones: { [idMiembros]: { titulo, nombre, … } } }
//
// La lista de fábrica es el código; `adicionales` son los que el Administrador
// Global añade con "Nuevo" y se suman detrás.
// ----------------------------------------------------------------------

export const COLECCION_TITULOS_OFICIALES = 'titulos_oficiales_nacionales';
export const DOCUMENTO_TITULOS_OFICIALES = 'actual';

export const TITULOS_OFICIALES_DE_FABRICA = Object.freeze([
  'Diseño y artes',
  'Proyectos de misiones',
  'Protocolo',
  'Comisión permanente de estatutos',
  'Encargado Senda adiestramiento Lideres Organizacionales (ALO)',
  'Coordinador tecnología',
  'Comité de Evaluaciones de premios y sendas ascenso',
]);

const LARGO_MAXIMO = 120;

// "protocolo " y "Protocolo" son el mismo título: sin esto se colaba un duplicado
// escrito con otra mayúscula o con un espacio de más.
export const claveDeTitulo = (titulo) =>
  String(titulo ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const limpiar = (titulo) =>
  String(titulo ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** Fábrica + añadidos, sin repetir y en ese orden. */
export function catalogoDeTitulos(adicionales = []) {
  const vistos = new Set();

  return [...TITULOS_OFICIALES_DE_FABRICA, ...(Array.isArray(adicionales) ? adicionales : [])]
    .map(limpiar)
    .filter((titulo) => {
      const clave = claveDeTitulo(titulo);

      if (!clave || vistos.has(clave)) return false;
      vistos.add(clave);

      return true;
    });
}

// SOLO CUENTA LA DIRECTIVA ACTUAL. `vigentes` son los ids de quienes ocupan hoy
// una casilla de Oficial Especial (`asignaciones_directiva` activas). Quien dejó
// de serlo conserva su fila guardada, pero su título ni se pinta ni bloquea a
// nadie: una posición de una directiva pasada no puede tocar el perfil de hoy.
// Sin `vigentes` (aún sin leer) se trata a todos como vigentes.
const esVigente = (vigentes, id) => !vigentes || vigentes.has(String(id));

const comoConjunto = (vigentes) =>
  vigentes ? new Set([...vigentes].map((id) => String(id ?? '').trim())) : null;

/** El título que lleva la persona si es Oficial Especial vigente, o ''. */
export function tituloDe(asignaciones = {}, idMiembro, vigentes = null) {
  const id = String(idMiembro ?? '').trim();

  if (!id || !esVigente(comoConjunto(vigentes), id)) return '';

  return limpiar(asignaciones?.[id]?.titulo) || '';
}

/**
 * Las opciones del desplegable, en el orden del catálogo y todas elegibles: cada
 * una dice quiénes (vigentes) la llevan ya, para ver de un vistazo cómo está
 * repartido. `propio` marca la de `idMiembro`.
 */
export function opcionesDeTitulo({
  catalogo = [],
  asignaciones = {},
  idMiembro,
  vigentes = null,
} = {}) {
  const id = String(idMiembro ?? '').trim();
  const conjunto = comoConjunto(vigentes);
  const personasPorClave = new Map();

  Object.entries(asignaciones || {}).forEach(([otroId, asignacion]) => {
    const clave = claveDeTitulo(asignacion?.titulo);

    if (!clave || !esVigente(conjunto, otroId)) return;

    personasPorClave.set(clave, [
      ...(personasPorClave.get(clave) || []),
      { id: otroId, nombre: asignacion?.nombre || '' },
    ]);
  });

  return catalogo.map((titulo) => {
    const personas = personasPorClave.get(claveDeTitulo(titulo)) || [];

    return {
      titulo,
      propio: personas.some((persona) => persona.id === id),
      personas,
    };
  });
}

/**
 * Las asignaciones tras dar `titulo` a `idMiembro` (o quitárselo con '' / null).
 * Da igual cuántos lo lleven ya; lo que no se permite es un título fuera de la
 * lista ni dárselo a quien hoy no es Oficial Especial.
 */
export function asignarTitulo(
  asignaciones = {},
  { idMiembro, titulo, catalogo = [], datos = {}, vigentes = null }
) {
  const id = String(idMiembro ?? '').trim();
  const conjunto = comoConjunto(vigentes);

  if (!id) throw new Error('Falta el miembro al que se asigna el título.');
  // Solo a quien HOY es Oficial Especial: uno de una directiva pasada no lleva título.
  if (!esVigente(conjunto, id)) {
    throw new Error('Solo se asigna título a un Oficial de la Nacional de la directiva actual.');
  }

  const siguientes = { ...(asignaciones || {}) };
  const limpio = limpiar(titulo);

  if (!limpio) {
    delete siguientes[id];
    return siguientes;
  }

  const clave = claveDeTitulo(limpio);
  const delCatalogo = catalogo.find((otro) => claveDeTitulo(otro) === clave);

  if (!delCatalogo) throw new Error(`"${limpio}" no está en la lista de títulos.`);

  siguientes[id] = { ...datos, titulo: delCatalogo };

  return siguientes;
}

/**
 * El mismo título a varias personas de una vez ("Asignar miembros"). `personas`
 * son `{ idMiembro, nombre }`. O entran todas o ninguna: si una no es Oficial
 * vigente, lanza antes de escribir nada.
 */
export function asignarTituloAVarios(
  asignaciones = {},
  { personas = [], titulo, catalogo = [], datos = {}, vigentes = null }
) {
  if (!limpiar(titulo)) throw new Error('Elige el título.');

  return (Array.isArray(personas) ? personas : []).reduce(
    (acumuladas, persona) =>
      asignarTitulo(acumuladas, {
        idMiembro: persona?.idMiembro,
        titulo,
        catalogo,
        vigentes,
        datos: { ...datos, nombre: persona?.nombre || '' },
      }),
    { ...(asignaciones || {}) }
  );
}

/** Los añadidos tras sumar `nombre`. Lanza si está vacío, es largo o ya existe. */
export function agregarTituloAlCatalogo(adicionales = [], nombre) {
  const limpio = limpiar(nombre);

  if (!limpio) throw new Error('Escribe el nombre del título.');
  if (limpio.length > LARGO_MAXIMO) {
    throw new Error(`El título no puede pasar de ${LARGO_MAXIMO} caracteres.`);
  }

  const lista = Array.isArray(adicionales) ? adicionales : [];

  if (catalogoDeTitulos(lista).some((titulo) => claveDeTitulo(titulo) === claveDeTitulo(limpio))) {
    throw new Error(`"${limpio}" ya está en la lista.`);
  }

  return [...lista, limpio];
}
