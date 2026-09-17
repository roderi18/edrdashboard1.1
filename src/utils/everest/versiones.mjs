// ----------------------------------------------------------------------
// LAS VERSIONES DE CADA BLOQUE, Y LO QUE CAMBIO ENTRE UNA Y OTRA (fase 5).
//
// Cada publicacion y cada "volver al original" deja una version en
// `everest_versiones`, escrita en el mismo lote que el cambio: sin eso, una
// publicacion podria quedar en la portada sin copia para volver atras.
//
// Puro a proposito, como `portada.mjs`: se prueba sin Firestore.
// ----------------------------------------------------------------------

import { esObjeto } from './saneado.mjs';
import { bloquePorId } from './bloques.mjs';
import { sanearPublicacion } from './publicacion.mjs';

export const ACCIONES_DE_VERSION = Object.freeze({
  publicar: 'publicar',
  original: 'original',
});

export const ETIQUETAS_DE_ACCION = Object.freeze({
  [ACCIONES_DE_VERSION.publicar]: 'Publicado',
  [ACCIONES_DE_VERSION.original]: 'Volvió al original',
});

/** Por esta clave se buscan las versiones de un bloque: una igualdad no pide índice. */
export const claveDeVersion = (pantalla, idBloque) => `${pantalla}/${idBloque}`;

const firma = (usuario) => ({
  uid: String(usuario?.uid || usuario?.id || ''),
  nombre: String(usuario?.displayName || usuario?.nombre || usuario?.email || ''),
});

/**
 * El documento de una version. `contenido` y `diseno` son lo que quedo en vivo:
 * lo publicado (ya saneado) o `null` cuando se volvio al original del codigo.
 */
export function prepararVersion({
  pantalla,
  idBloque,
  accion,
  contenido = null,
  diseno = {},
  usuario = {},
  ahora = new Date(),
}) {
  if (!Object.values(ACCIONES_DE_VERSION).includes(accion)) {
    throw new Error(`"${accion}" no es una acción de versión.`);
  }

  return {
    pantalla,
    idBloque,
    clave: claveDeVersion(pantalla, idBloque),
    accion,
    contenido: accion === ACCIONES_DE_VERSION.original ? null : contenido,
    diseno: accion === ACCIONES_DE_VERSION.original ? null : diseno,
    creadoEn: ahora.toISOString(),
    creadoPor: firma(usuario),
  };
}

/**
 * Las versiones leidas, de la mas nueva a la mas vieja. Lo que no tenga forma de
 * version se deja fuera: una lista rota no debe tumbar el panel.
 */
export function ordenarVersiones(documentos = []) {
  return (Array.isArray(documentos) ? documentos : [])
    .filter(
      (version) =>
        esObjeto(version) &&
        typeof version.creadoEn === 'string' &&
        Object.values(ACCIONES_DE_VERSION).includes(version.accion)
    )
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/**
 * El contenido y el diseño de una version, listos para abrirse en el editor
 * (`{ contenido, diseno }`), o `null` si no se puede: es un "volver al original"
 * o ya no pasa el saneado de hoy (el bloque pudo cambiar de forma desde que se
 * guardo). Las versiones de antes del diseño no lo traen: se abren con uno vacio.
 */
export function publicacionDeVersion(version) {
  if (!esObjeto(version) || version.accion !== ACCIONES_DE_VERSION.publicar) return null;

  return sanearPublicacion(bloquePorId(version.idBloque), {
    contenido: version.contenido,
    diseno: version.diseno ?? undefined,
  });
}

// ----------------------------------------------------------------------
// ANTES Y DESPUES, PARA HISTORIAL
// ----------------------------------------------------------------------

const LARGO_MAXIMO = 120;

const recortar = (texto) =>
  texto.length > LARGO_MAXIMO ? `${texto.slice(0, LARGO_MAXIMO - 1)}…` : texto;

const nombreDeElemento = (elemento) =>
  esObjeto(elemento)
    ? elemento.titulo || elemento.nombre || elemento.texto || elemento.etiqueta || ''
    : String(elemento ?? '');

/** Un valor cualquiera como texto corto, para que Historial se lea sin abrir JSON. */
export function resumirValor(valor) {
  if (valor === undefined || valor === null || valor === '') return '—';
  if (typeof valor === 'string') return recortar(valor);
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);

  if (Array.isArray(valor)) {
    const nombres = valor.map(nombreDeElemento).filter(Boolean);
    const cuantos = `${valor.length} ${valor.length === 1 ? 'elemento' : 'elementos'}`;

    return recortar(nombres.length ? `${cuantos}: ${nombres.join(', ')}` : cuantos);
  }

  if (esObjeto(valor)) {
    return recortar(
      Object.entries(valor)
        .map(([clave, dentro]) => `${clave}: ${resumirValor(dentro)}`)
        .join(' · ')
    );
  }

  return '—';
}

const iguales = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Lo que cambio en un bloque, campo a campo: `[{ campo, etiqueta, antes, despues }]`,
 * la forma que pide `proponerCambio`. Un bloque que es una lista (comunicados,
 * historias…) se compara entero. Sin diferencias, la lista sale vacia.
 */
export function diferenciasDelBloque({ idBloque, antes, despues }) {
  const nombre = bloquePorId(idBloque)?.nombre || idBloque;

  if (!esObjeto(antes) || !esObjeto(despues)) {
    return iguales(antes, despues)
      ? []
      : [
          {
            campo: idBloque,
            etiqueta: nombre,
            antes: resumirValor(antes),
            despues: resumirValor(despues),
          },
        ];
  }

  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];

  return campos
    .filter((campo) => !iguales(antes[campo], despues[campo]))
    .map((campo) => ({
      // Historial guarda antes y despues por `campo`: el bloque ya va en la entidad.
      campo,
      etiqueta: `${nombre} · ${campo}`,
      antes: resumirValor(antes[campo]),
      despues: resumirValor(despues[campo]),
    }));
}
