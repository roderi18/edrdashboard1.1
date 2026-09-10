import { getDoc } from 'firebase/firestore';

import { sanearDiseno, DISENO_POR_DEFECTO } from 'src/utils/store-header-design.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import {
  escribirEncabezadoTienda,
  DOCUMENTO_ENCABEZADO_TIENDA,
  referenciaDelEncabezadoTienda,
  COLECCION_CONFIGURACION_TIENDA,
} from './store-settings-apply';

// ----------------------------------------------------------------------
// EL ENCABEZADO DE LA TIENDA, ESCRITO POR EL ADMINISTRADOR GLOBAL.
//
// Un solo documento —el mismo patron que `respaldos_admin/ultimo`—: la tienda es
// una y su encabezado tambien. Si no existe, se sirven los textos de abajo, que
// es lo que se ve mientras nadie lo haya cambiado.
//
// Quien escribe lo decide `firestore.rules`: leer, cualquier sesion del sistema;
// escribir, solo el Administrador Global.
//
// Y se escribe POR LA PUERTA (`proponerCambio`), como todo en este proyecto: el
// ambito `tienda` se aplica en el momento, pero queda en Historial. Un texto que
// leen todos los que entran a la tienda no puede cambiar sin que conste quien lo
// cambio.
// ----------------------------------------------------------------------

export { DOCUMENTO_ENCABEZADO_TIENDA, COLECCION_CONFIGURACION_TIENDA };

// LAS DOS FORMAS DE COLOCAR LOS TEXTOS.
//
// `clasica` es la de siempre: sobretitulo, titulo y lema, uno debajo de otro.
// `franja` es la del rotulo impreso: a la izquierda el titulo con el pais
// debajo, una raya vertical, y el lema a la derecha.
//
// Se guarda el NOMBRE de la disposicion, no las medidas: quien la elige decide
// una forma, no una maquetacion, y asi la portada puede cambiar de aspecto sin
// tocar lo que hay guardado.
export const DISPOSICION_CLASICA = 'clasica';
export const DISPOSICION_FRANJA = 'franja';
export const DISPOSICIONES_ENCABEZADO = [DISPOSICION_CLASICA, DISPOSICION_FRANJA];

export const ENCABEZADO_TIENDA_POR_DEFECTO = {
  titulo: 'Exploradores del Rey',
  subtitulo: 'Equipando hoy a los líderes del mañana',
  // Sin foto la portada sigue siendo el degradado del tema: no hay imagen por
  // defecto que mantener ni que sustituir.
  fotoUrl: '',
  // Como se colocan los textos. La clasica es la de siempre —lema debajo del
  // titulo— y es la que se sirve mientras nadie elija otra cosa.
  disposicion: DISPOSICION_CLASICA,
  // Solo se lee en la disposicion de franja, debajo del titulo.
  pieTitulo: 'República Dominicana',
  // El diseño libre, apagado. Mientras `activo` sea falso manda la disposicion
  // de arriba: encender el editor avanzado es una decision, no un accidente.
  disenoAvanzado: DISENO_POR_DEFECTO,
};

const limpiar = (valor) => String(valor ?? '').trim();

// LO QUE HABIA ANTES DEL ULTIMO CAMBIO, guardado en el propio documento.
//
// No basta con el Historial: alli consta QUE cambio y quien lo hizo, pero para
// devolver la portada hay que tener los valores. Se guarda una sola version
// hacia atras —un paso— porque eso es lo que se pide cuando algo sale mal: "que
// vuelva a como estaba hace un minuto". Para lo demas esta el de fabrica.
const instantaneaDelEncabezado = (encabezado) => ({
  titulo: encabezado.titulo,
  subtitulo: encabezado.subtitulo,
  fotoUrl: encabezado.fotoUrl,
  disposicion: encabezado.disposicion,
  pieTitulo: encabezado.pieTitulo,
  disenoAvanzado: encabezado.disenoAvanzado,
});

/** Como se cuenta el diseño libre en Historial: encendido y cuantos textos. */
const describirDiseno = (diseno) =>
  diseno?.activo ? `Activo · ${diseno.elementos.length} texto(s)` : 'Desactivado';

const disposicionValida = (valor) =>
  DISPOSICIONES_ENCABEZADO.includes(limpiar(valor)) ? limpiar(valor) : DISPOSICION_CLASICA;

const leerEncabezado = async () => {
  const instantanea = await getDoc(referenciaDelEncabezadoTienda()).catch(() => null);

  return instantanea?.exists() ? instantanea.data() : null;
};

const conValoresPorDefecto = (datos) => ({
  titulo: limpiar(datos?.titulo) || ENCABEZADO_TIENDA_POR_DEFECTO.titulo,
  subtitulo: limpiar(datos?.subtitulo) || ENCABEZADO_TIENDA_POR_DEFECTO.subtitulo,
  // La foto SI se puede dejar en blanco: quitarla es una decision valida y
  // vuelve a dejar la portada con el degradado.
  fotoUrl: limpiar(datos?.fotoUrl),
  disposicion: disposicionValida(datos?.disposicion),
  pieTitulo: limpiar(datos?.pieTitulo) || ENCABEZADO_TIENDA_POR_DEFECTO.pieTitulo,
  // SE SANEA AL LEER, no solo al escribir. Lo guardado pudo entrar por otra via
  // —una consola, una version anterior del editor— y aqui es donde se decide
  // que llega a la pantalla del cliente.
  disenoAvanzado: sanearDiseno(datos?.disenoAvanzado),
});

/** Los textos guardados mas la version anterior, si la hay. */
const conAnterior = (datos) => ({
  ...conValoresPorDefecto(datos),
  // Se sanea igual que lo actual: un dia va a volver a ser lo actual.
  anterior: datos?.anterior ? conValoresPorDefecto(datos.anterior) : null,
});

/** Los textos guardados, o los de por defecto. Nunca lanza: es la portada. */
export async function obtenerEncabezadoTienda() {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return ENCABEZADO_TIENDA_POR_DEFECTO;
  }

  return conAnterior(await leerEncabezado());
}

/**
 * Guarda los dos textos y la fotografia de la portada.
 *
 * Un TEXTO vacio NO se borra: vuelve al de por defecto. Un encabezado en blanco
 * no es una decision que nadie quiera tomar sin querer. La FOTO si se puede
 * dejar en blanco: es quitarla, y la portada vuelve al degradado.
 */
export async function guardarEncabezadoTienda(
  { titulo, subtitulo, fotoUrl, disposicion, pieTitulo, disenoAvanzado } = {},
  usuario = {}
) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  const anterior = conValoresPorDefecto(await leerEncabezado());
  const encabezado = conValoresPorDefecto({
    titulo,
    subtitulo,
    fotoUrl,
    disposicion,
    pieTitulo,
    disenoAvanzado,
  });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.tienda,
    entidad: {
      tipo: 'configuracion',
      id: DOCUMENTO_ENCABEZADO_TIENDA,
      nombre: 'Encabezado de la tienda',
      ruta: '/dashboard/product',
    },
    cambios: [
      {
        campo: 'titulo',
        etiqueta: 'Título',
        antes: anterior.titulo,
        despues: encabezado.titulo,
      },
      {
        campo: 'subtitulo',
        etiqueta: 'Subtítulo',
        antes: anterior.subtitulo,
        despues: encabezado.subtitulo,
      },
      {
        campo: 'fotoUrl',
        etiqueta: 'Fotografía',
        antes: anterior.fotoUrl,
        despues: encabezado.fotoUrl,
      },
      {
        campo: 'disposicion',
        etiqueta: 'Disposición',
        antes: anterior.disposicion,
        despues: encabezado.disposicion,
      },
      {
        campo: 'pieTitulo',
        etiqueta: 'Texto bajo el título',
        antes: anterior.pieTitulo,
        despues: encabezado.pieTitulo,
      },
      {
        // El diseño libre entra en Historial COMO TEXTO. Un objeto anidado no se
        // puede comparar de un vistazo en la lista de cambios, y lo que importa
        // ahi es poder ver que algo cambio y quien lo cambio.
        campo: 'disenoAvanzado',
        etiqueta: 'Diseño avanzado',
        antes: describirDiseno(anterior.disenoAvanzado),
        despues: describirDiseno(encabezado.disenoAvanzado),
      },
    ],
    usuario,
    descripcion: 'Encabezado de la tienda actualizado.',
    aplicar: () => escribirEncabezadoTienda({ ...encabezado, anterior: instantaneaDelEncabezado(anterior) }),
  });

  return { ...encabezado, anterior: instantaneaDelEncabezado(anterior) };
}

export const DESTINOS_REVERSION = {
  anterior: 'anterior',
  fabrica: 'fabrica',
};

/**
 * Devuelve la portada a como estaba.
 *
 * Dos destinos y ninguno mas: al PASO ANTERIOR —lo que habia antes del ultimo
 * guardado— o a la portada DE FABRICA, la que se sirve cuando nadie ha tocado
 * nada. En medio no hay nada que ofrecer sin inventarse un historial de
 * versiones que este proyecto no tiene.
 *
 * Revertir NO es una puerta trasera: entra por `guardarEncabezadoTienda` como
 * cualquier otro cambio, asi que queda en Historial con su autor. Y como lo
 * hace, la portada que se estaba viendo pasa a ser la "anterior": revertir dos
 * veces devuelve donde se estaba, que es lo que espera quien se equivoco al
 * revertir.
 */
export async function revertirEncabezadoTienda(destino, usuario = {}) {
  const actual = await obtenerEncabezadoTienda();

  if (destino === DESTINOS_REVERSION.fabrica) {
    return guardarEncabezadoTienda(
      {
        ...ENCABEZADO_TIENDA_POR_DEFECTO,
        // La foto no se borra al volver de fabrica: es un archivo que alguien
        // subio, y quitarla es otra decision, con su propio boton.
        fotoUrl: actual.fotoUrl,
        disenoAvanzado: { ...DISENO_POR_DEFECTO, activo: false },
      },
      usuario
    );
  }

  if (!actual.anterior) {
    throw new Error('No hay un cambio anterior al que volver.');
  }

  return guardarEncabezadoTienda(actual.anterior, usuario);
}
