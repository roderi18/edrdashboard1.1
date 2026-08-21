import { doc, setDoc, collection } from 'firebase/firestore';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// Escritura del primer acceso. Vive aparte de la vista porque la escritura en
// Firestore solo se hace desde la funcion que aplica un cambio ya registrado en
// Historial: quien llama aqui es `proponerCambio`, nunca un formulario.
// ----------------------------------------------------------------------

export async function marcarClaveCambiada({ idDocumento, correoPersonal = '' }) {
  if (!idDocumento) return;

  await setDoc(
    doc(collection(FIRESTORE, 'usuarios_roles'), String(idDocumento)),
    {
      debeCambiarClave: false,
      claveCambiadaEn: new Date().toISOString(),
      ...(correoPersonal ? { correoPersonal } : {}),
    },
    { merge: true }
  );
}
