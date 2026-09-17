import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LAS PREFERENCIAS DE CADA PERSONA, guardadas en su perfil.
//
// Un documento por uid (`preferencias_usuarios/<uid>`): solo lo lee y lo escribe
// su dueño, y viaja con la cuenta —otra pestaña, otro equipo—, cosa que el
// almacenamiento del navegador no hace.
//
// Hoy guarda una sola cosa: el destacamento que el Administrador Global eligio en
// Asistencia mientras prueba un rol combinado. La prueba lo acota a un
// destacamento de ejemplo y el selector desaparecia; ahora elige el que quiere
// mirar y se queda puesto hasta que lo cambie.
// ----------------------------------------------------------------------

export const COLECCION_PREFERENCIAS_USUARIOS = 'preferencias_usuarios';

const referencia = (uid) => doc(FIRESTORE, COLECCION_PREFERENCIAS_USUARIOS, String(uid));

export const obtenerDestacamentoDeAsistencia = async (uid) => {
  if (!isFirebaseConfigured || !FIRESTORE || !uid) return '';

  const snapshot = await getDoc(referencia(uid));

  return String(snapshot.exists() ? (snapshot.data()?.asistencia?.idDestacamento ?? '') : '');
};

export const guardarDestacamentoDeAsistencia = async (uid, idDestacamento) => {
  if (!isFirebaseConfigured || !FIRESTORE || !uid || !idDestacamento) return;

  await setDoc(
    referencia(uid),
    {
      uid: String(uid),
      asistencia: { idDestacamento: String(idDestacamento) },
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
};
