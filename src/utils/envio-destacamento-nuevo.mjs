// ----------------------------------------------------------------------
// ENVÍOS "DESTACAMENTO NUEVO": ¿DE VERDAD NO EXISTE?
// Desde la página de registro, quien no encuentra su destacamento pulsa "Mi
// destacamento no está" y el envío llega como nuevo. La carga los saltaba
// siempre ("créalo en Destacamentos"), aunque el destacamento sí existiera: el
// "leones de Sion 275" es el Destacamento 275 del padrón. Ahora quien revisa
// decide: actualizar sobre uno existente o crearlo nuevo, y crearlo solo se
// permite si ninguno del padrón coincide (mismo número o mismo nombre), para
// no duplicar.
// ----------------------------------------------------------------------

const sinTildes = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const numeroDe = (valor) => {
  const n = Number.parseInt(String(valor ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
};

// "Desconocido" y similares no son un nombre: no sirven para emparejar.
const nombreUtil = (valor) => {
  const n = sinTildes(valor);
  return n && !n.startsWith('desconocid') && n !== 'provisional' ? n : '';
};

/**
 * Destacamentos del padrón (forma cruda de la API: idDestacamento, nombre,
 * numero) que podrían ser el del envío, con el motivo. Primero los de mismo número.
 */
export function candidatosParaEnvioNuevo(fila, padron = []) {
  const numero = numeroDe(fila?.numeroDestacamento ?? fila?.datos?.numero);
  const nombre = nombreUtil(fila?.nombreDestacamento ?? fila?.datos?.nombre);
  const candidatos = [];
  padron.forEach((d) => {
    if (sinTildes(d?.nombre) === 'provisional') return;
    const mismoNumero = numero !== null && numeroDe(d?.numero) === numero;
    const mismoNombre = Boolean(nombre) && nombreUtil(d?.nombre) === nombre;
    if (mismoNumero || mismoNombre)
      candidatos.push({ destacamento: d, motivo: mismoNumero ? 'numero' : 'nombre' });
  });
  return candidatos.sort((a, b) => (a.motivo === b.motivo ? 0 : a.motivo === 'numero' ? -1 : 1));
}

/** Crear nuevo solo cuando ninguno del padrón coincide. */
export const puedeCrearseComoNuevo = (fila, padron) =>
  candidatosParaEnvioNuevo(fila, padron).length === 0;
