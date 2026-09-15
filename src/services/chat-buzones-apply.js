import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_BUZONES_CHAT } from 'src/utils/chat-buzones.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA la foto de un buzon compartido del chat.
//
// Mismo caso que `store-settings-apply.js`: aqui solo vive la escritura que
// `proponerCambio` ejecuta DESPUES de haber registrado el cambio en Historial. No
// es una puerta paralela —nadie llama a esto sin pasar antes por la puerta—, pero
// la regla de ESLint mira la sintaxis y no puede distinguir una cosa de la otra.
// ----------------------------------------------------------------------

export const referenciaDeBuzonChat = (clave) => doc(FIRESTORE, COLECCION_BUZONES_CHAT, clave);

export const escribirAvatarDeBuzon = ({ clave, avatarUrl, usuario = {} }) =>
  setDoc(
    referenciaDeBuzonChat(clave),
    {
      clave,
      avatarUrl,
      actualizadoPor: String(usuario?.uid || usuario?.id || ''),
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
