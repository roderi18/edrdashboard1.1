import { getDoc } from 'firebase/firestore';

import {
  AVISOS,
  SIN_SONIDO,
  sonidoPorClave,
  eleccionPorDefecto,
} from 'src/utils/sonidos-de-aviso.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

import { escribirSonidosDeAviso, referenciaDeLosSonidos } from './sonidos-apply';

// ----------------------------------------------------------------------
// QUE SUENA EN CADA AVISO, PARA TODA LA ORGANIZACION.
//
// Lo elige el Administrador Global en Administracion → Sonidos y lo oye todo el
// mundo: no es una preferencia de cada quien —para eso estaria en el panel de
// ajustes—, es como suena la aplicacion. Por eso pasa por la puerta de cambios:
// se aplica en el acto, pero queda en Historial quien lo cambio y desde que
// sonido a cual.
//
// Un solo documento, `configuracion_sonidos/avisos`, con una linea por aviso.
// ----------------------------------------------------------------------

export const CLAVE_EN_EL_NAVEGADOR = 'erd-sonidos-de-aviso';

/** Solo claves conocidas y sonidos que existen: lo demas vuelve a lo de fabrica. */
export const depurarEleccion = (guardado) => {
  const porDefecto = eleccionPorDefecto();

  if (!guardado || typeof guardado !== 'object') return porDefecto;

  return Object.fromEntries(
    AVISOS.map((aviso) => {
      const elegido = guardado[aviso.clave];
      const valido = elegido === SIN_SONIDO || Boolean(sonidoPorClave(elegido));

      return [aviso.clave, valido ? elegido : porDefecto[aviso.clave]];
    })
  );
};

export async function obtenerSonidosDeAviso() {
  if (!isFirebaseConfigured || !FIRESTORE) return eleccionPorDefecto();

  const guardado = await getDoc(referenciaDeLosSonidos()).catch(() => null);

  return depurarEleccion(guardado?.exists() ? guardado.data() : null);
}

const nombreDelSonido = (clave) =>
  clave === SIN_SONIDO ? 'Sin sonido' : (sonidoPorClave(clave)?.nombre ?? clave);

export async function guardarSonidosDeAviso(eleccion, usuario = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  const anterior = await obtenerSonidosDeAviso();
  const limpia = depurarEleccion(eleccion);
  const cambios = AVISOS.filter((aviso) => limpia[aviso.clave] !== anterior[aviso.clave]).map(
    (aviso) => ({
      campo: aviso.clave,
      etiqueta: aviso.nombre,
      antes: nombreDelSonido(anterior[aviso.clave]),
      despues: nombreDelSonido(limpia[aviso.clave]),
    })
  );

  if (!cambios.length) return limpia;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.sonidosDeAviso,
    entidad: {
      tipo: 'configuracion',
      id: 'avisos',
      nombre: 'Sonidos de aviso',
      ruta: '/dashboard/admin/sonidos',
    },
    cambios,
    usuario,
    descripcion: `Sonidos de aviso: ${cambios
      .map((cambio) => `${cambio.etiqueta} → ${cambio.despues}`)
      .join(', ')}.`,
    aplicar: () => escribirSonidosDeAviso(limpia),
  });

  return limpia;
}

// LA COPIA EN EL NAVEGADOR, PARA QUE SUENE DESDE EL PRIMER AVISO.
//
// Leer Firestore tarda unas decimas; el primer mensaje que llega justo al entrar
// sonaria con el sonido de fabrica o no sonaria. Se guarda lo ultimo conocido y
// se usa mientras llega la respuesta de verdad.
export const leerCopiaLocal = () => {
  try {
    return depurarEleccion(
      JSON.parse(window.localStorage.getItem(CLAVE_EN_EL_NAVEGADOR) ?? 'null')
    );
  } catch {
    return eleccionPorDefecto();
  }
};

export const guardarCopiaLocal = (eleccion) => {
  try {
    window.localStorage.setItem(CLAVE_EN_EL_NAVEGADOR, JSON.stringify(eleccion));
  } catch {
    // Ventana privada: se pierde al recargar y no pasa nada, Firestore manda.
  }
};
