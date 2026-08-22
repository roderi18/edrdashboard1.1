import { getDocs, collection } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  ABREVIATURAS_PAIS,
  ABREVIATURAS_PROVINCIA,
  normalizarAbreviaturaPais,
} from 'src/catalogs/provincias-abreviaturas';

// ----------------------------------------------------------------------
// Tabla de abreviaturas de provincia. Vive en Firestore para que se pueda
// corregir sin desplegar; el catalogo local es el respaldo si Firestore no
// responde, porque quedarse sin tabla significaria no poder crear miembros.
// ----------------------------------------------------------------------

export const COLECCION_PROVINCIAS = 'catalogo_provincias';
export const COLECCION_PAISES = 'catalogo_paises';

let cache = null;

export async function obtenerAbreviaturasProvincia({ recargar = false } = {}) {
  if (cache && !recargar) return cache;

  if (!isFirebaseConfigured || !FIRESTORE) {
    cache = ABREVIATURAS_PROVINCIA;
    return cache;
  }

  try {
    const snap = await getDocs(collection(FIRESTORE, COLECCION_PROVINCIAS));

    if (snap.empty) {
      cache = ABREVIATURAS_PROVINCIA;
      return cache;
    }

    const tabla = {};
    snap.forEach((documento) => {
      const datos = documento.data();
      const nombre = datos?.nombre || documento.id;
      const abreviatura = datos?.abreviatura || '';

      if (nombre && abreviatura) tabla[nombre] = abreviatura;
    });

    cache = Object.keys(tabla).length ? tabla : ABREVIATURAS_PROVINCIA;
    return cache;
  } catch {
    cache = ABREVIATURAS_PROVINCIA;
    return cache;
  }
}

let cachePaises = null;

// Abreviatura del pais por su id. Misma idea que las provincias: la fuente viva
// esta en Firestore para poder corregirla sin desplegar, y el catalogo local
// responde si Firestore no contesta.
export async function obtenerAbreviaturasPais({ recargar = false } = {}) {
  if (cachePaises && !recargar) return cachePaises;

  if (!isFirebaseConfigured || !FIRESTORE) {
    cachePaises = ABREVIATURAS_PAIS;
    return cachePaises;
  }

  try {
    const snap = await getDocs(collection(FIRESTORE, COLECCION_PAISES));

    if (snap.empty) {
      cachePaises = ABREVIATURAS_PAIS;
      return cachePaises;
    }

    const tabla = {};
    snap.forEach((documento) => {
      // Se normaliza al leer: la tabla de Firestore todavia puede traer `RD`,
      // que es la abreviatura retirada, y de ahi salian codigos `RD-...`.
      const abreviatura = normalizarAbreviaturaPais(documento.data()?.abreviatura);

      if (abreviatura) tabla[documento.id] = abreviatura;
    });

    cachePaises = Object.keys(tabla).length ? tabla : ABREVIATURAS_PAIS;
    return cachePaises;
  } catch {
    cachePaises = ABREVIATURAS_PAIS;
    return cachePaises;
  }
}
