import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

import { COLECCIONES_EVEREST } from 'src/utils/everest/colecciones.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// CUANTA GENTE VIO CADA BLOQUE DE LA PORTADA Y CUANTA PULSO ALGO (fase 8).
//
// Igual que las analiticas del encabezado de la tienda: dos numeros por bloque
// —y por campaña— y nada mas. NO se guarda quien miro: la portada la ve toda la
// organizacion, menores incluidos, y un registro con nombres convertiria un
// contador en un rastro de navegacion. Para decidir si un bloque funciona basta
// el total.
//
// UNA ESCRITURA POR VISITA, no una por bloque: todas las impresiones van juntas
// en el documento de la pantalla, con `increment` —leer y sumar perderia cuentas
// cuando dos personas entran a la vez—. Y una sola vez por sesion del navegador:
// recargar la portada diez veces no son diez personas.
//
// NO SE ROMPE NADA SI FALLA. Contar es lo menos importante que pasa en la
// portada: si la escritura no sale, se ve igual.
// ----------------------------------------------------------------------

const referencia = (pantalla) => doc(FIRESTORE, COLECCIONES_EVEREST.analiticas, pantalla);

const CLAVE_DE_SESION = 'erd-everest-impresiones';

const yaContadas = () => {
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(CLAVE_DE_SESION) ?? '[]'));
  } catch {
    return new Set();
  }
};

const recordarContadas = (claves) => {
  try {
    window.sessionStorage.setItem(CLAVE_DE_SESION, JSON.stringify([...claves]));
  } catch {
    // Ventana privada: se contara otra vez en la siguiente visita, nada mas.
  }
};

/** `{ bloques: { id: {...} }, campanas: { id: {...} } }` con un contador sumado. */
const sumando = (vistos, campo) => {
  const datos = { bloques: {}, campanas: {} };

  vistos.forEach(({ idBloque, idCampana }) => {
    if (idCampana) datos.campanas[idCampana] = { [campo]: increment(1) };
    else datos.bloques[idBloque] = { [campo]: increment(1) };
  });

  return datos;
};

const escribir = async (pantalla, datos) => {
  if (!isFirebaseConfigured || !FIRESTORE) return;

  try {
    await setDoc(
      referencia(pantalla),
      { ...datos, actualizadoEn: serverTimestamp() },
      { merge: true }
    );
  } catch {
    // A proposito en silencio: nadie puede hacer nada con este error.
  }
};

/**
 * Una impresion por bloque visto. `vistos` es `[{ idBloque, idCampana? }]`; los ya
 * contados en esta sesion se saltan.
 */
export async function registrarImpresionesDePortada(pantalla, vistos = []) {
  const contadas = yaContadas();
  const nuevos = vistos.filter(({ idBloque, idCampana }) => {
    const clave = `${pantalla}:${idCampana || idBloque}`;

    if (contadas.has(clave)) return false;

    contadas.add(clave);

    return true;
  });

  if (!nuevos.length) return;

  recordarContadas(contadas);
  await escribir(pantalla, sumando(nuevos, 'impresiones'));
}

/** Una pulsacion en un enlace o boton de un bloque. */
export async function registrarClicDePortada(pantalla, { idBloque, idCampana }) {
  await escribir(pantalla, sumando([{ idBloque, idCampana }], 'clics'));
}

/**
 * Lo contado hasta ahora. Solo lo lee el Administrador Global (lo dicen las
 * reglas). Sin datos o sin permiso, vacio: el panel dice "sin datos".
 */
export async function obtenerAnaliticasDePortada(pantalla) {
  if (!isFirebaseConfigured || !FIRESTORE) return { bloques: {}, campanas: {} };

  const documento = await getDoc(referencia(pantalla)).catch(() => null);
  const datos = documento?.exists() ? documento.data() : {};

  const limpiar = (mapa) =>
    Object.fromEntries(
      Object.entries(mapa && typeof mapa === 'object' ? mapa : {}).map(([clave, valor]) => [
        clave,
        {
          impresiones: Number(valor?.impresiones ?? 0) || 0,
          clics: Number(valor?.clics ?? 0) || 0,
        },
      ])
    );

  return { bloques: limpiar(datos.bloques), campanas: limpiar(datos.campanas) };
}
