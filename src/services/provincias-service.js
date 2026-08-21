import { getDocs, collection } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { ABREVIATURAS_PROVINCIA } from 'src/catalogs/provincias-abreviaturas';

// ----------------------------------------------------------------------
// Tabla de abreviaturas de provincia. Vive en Firestore para que se pueda
// corregir sin desplegar; el catalogo local es el respaldo si Firestore no
// responde, porque quedarse sin tabla significaria no poder crear miembros.
// ----------------------------------------------------------------------

export const COLECCION_PROVINCIAS = 'catalogo_provincias';

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
