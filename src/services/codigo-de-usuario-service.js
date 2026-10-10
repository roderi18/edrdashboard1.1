import { doc, getDoc } from 'firebase/firestore';

import { conCache } from 'src/utils/cache-de-lecturas.mjs';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL CÓDIGO DE MIEMBRO DE UNA CUENTA, por su uid (`usuarios/{uid}`).
//
// Los registros viejos (lotes de certificados, emisiones ONERRD) guardaron
// quién los creó solo con uid y nombre; "Certificados creados" enseña además
// su código debajo del nombre. Los nuevos ya lo guardan; para los de antes se
// busca aquí. Sin cuenta o sin código, '' (nunca rompe la lista).
// ----------------------------------------------------------------------

export const leerCodigoDeUsuario = conCache('codigo-de-usuario', async (uid) => {
  if (!uid || !isFirebaseConfigured || !FIRESTORE) return '';
  try {
    const ficha = await getDoc(doc(FIRESTORE, COLECCIONES.usuarios, String(uid)));
    const datos = ficha.exists() ? ficha.data() : {};
    return String(datos.codigoMiembro || datos.codigoUsuario || '');
  } catch {
    return '';
  }
});
