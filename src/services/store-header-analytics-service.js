import { doc, setDoc, getDocs, increment, collection, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// CUANTA GENTE VIO LA PROMOCION Y CUANTA LA PULSO.
//
// Dos numeros por elemento y nada mas. NO se guarda quien miro: la portada la
// ve todo el que entra a la tienda —incluidos menores—, y un registro con
// nombres convertiria un contador de carteles en un rastro de navegacion. Lo
// que se necesita para decidir si una promocion funciona es el total.
//
// Se escribe con `increment`, no leyendo y sumando: dos personas mirando a la
// vez perderian una de las dos cuentas.
//
// Y NO SE ROMPE NADA SI FALLA. Contar una impresion es lo menos importante que
// pasa en esa pantalla: si la escritura no sale, la portada se ve igual.
// ----------------------------------------------------------------------

export const COLECCION_ANALITICAS_ENCABEZADO = 'analiticas_encabezado_tienda';

const referencia = (idElemento) =>
  doc(FIRESTORE, COLECCION_ANALITICAS_ENCABEZADO, String(idElemento));

const anotar = async (idElemento, campo) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idElemento) return;

  try {
    await setDoc(
      referencia(idElemento),
      { [campo]: increment(1), actualizadoEn: serverTimestamp() },
      { merge: true }
    );
  } catch {
    // A proposito en silencio: no hay nada que el usuario pueda hacer con este
    // error, y un aviso rojo por no haber contado un cartel seria peor que el
    // dato que falta.
  }
};

/** Una visita a cada elemento que se vio. */
export async function registrarImpresionesEncabezado(idsElementos = []) {
  await Promise.all([...new Set(idsElementos)].map((id) => anotar(id, 'impresiones')));
}

/** Una pulsacion en un elemento con enlace. */
export async function registrarClicEncabezado(idElemento) {
  await anotar(idElemento, 'clics');
}

/**
 * Lo contado hasta ahora, por elemento.
 *
 * Lo lee quien administra la tienda; el cliente escribe pero no consulta —no es
 * informacion suya— y de eso se encarga `firestore.rules`.
 */
export async function obtenerAnaliticasEncabezado() {
  if (!isFirebaseConfigured || !FIRESTORE) return {};

  const instantanea = await getDocs(collection(FIRESTORE, COLECCION_ANALITICAS_ENCABEZADO)).catch(
    () => null
  );

  if (!instantanea) return {};

  return Object.fromEntries(
    instantanea.docs.map((documento) => [
      documento.id,
      {
        impresiones: Number(documento.data()?.impresiones ?? 0),
        clics: Number(documento.data()?.clics ?? 0),
      },
    ])
  );
}
