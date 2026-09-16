import { mutate } from 'swr';
import { useEffect } from 'react';
import { query, where, collection, onSnapshot } from 'firebase/firestore';

import { sonarAviso } from 'src/utils/sonidos-de-aviso.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { isConversationsKey, isChatUnreadSummaryKey } from 'src/actions/chat';

import { debeSonarPorMensajeNuevo } from '../utils/sonido-de-mensaje.mjs';

// ----------------------------------------------------------------------
// LOS BUZONES COMPARTIDOS, EN TIEMPO REAL, desde cualquier pantalla.
//
// La escucha del chat (`useChatRealtimeSync`) sigue a UNA identidad: la persona,
// o el buzon en cuya bandeja se esta. Quien atiende la Tienda o la Oficina y
// estaba en otra pantalla —o en "Mis chats"— no se enteraba de que alguien les
// habia escrito: el contador no se movia hasta volver a la ventana.
//
// Esto escucha las conversaciones de cada buzon que atiende la sesion y, al
// cambiar una, revalida los contadores y las listas. No marca nada como
// entregado ni leido: eso lo hace el chat cuando de verdad se abre la bandeja.
// Las reglas dejan leerlas a quien ejerce su cargo (`atiendeUnBuzon`).
//
// Y SUENA, como suena un mensaje propio. Lo que le escriben a la Tienda se veia
// llegar —el contador subia— pero en silencio: quien la atiende desde la
// pantalla de inicio no tenia por que estar mirando el numerito. La decision de
// si suena es la misma de siempre (`debeSonarPorMensajeNuevo`), que ademas
// comparte memoria con la escucha del chat: estando dentro de la bandeja, el
// mensaje no suena dos veces.
// ----------------------------------------------------------------------

export function useBuzonesEnVivo(buzones = [], enabled = true) {
  const claves = buzones.map((buzon) => buzon.idMiembros).join(',');

  useEffect(() => {
    if (!enabled || !claves || !isFirebaseConfigured || !FIRESTORE) return undefined;

    const cancelaciones = claves.split(',').map((idMiembros) => {
      let primeraFoto = true;

      return onSnapshot(
        query(
          collection(FIRESTORE, 'conversaciones_chat'),
          where('participantesIds', 'array-contains', Number(idMiembros))
        ),
        (snapshot) => {
          const esPrimeraFoto = primeraFoto;
          const cambios = snapshot.docChanges();

          primeraFoto = false;

          // La primera foto es lo que ya habia: no suena, pero SI se apunta.
          // Sin apuntarla, el primer acuse de entrega de una conversacion vieja
          // con mensajes sin leer se habria tomado por un mensaje recien
          // llegado.
          cambios.forEach((cambio) => {
            if (cambio.type === 'removed') return;

            const conversacion = cambio.doc.data();

            if (conversacion?.eliminada === true) return;

            if (
              debeSonarPorMensajeNuevo(
                { ...conversacion, idConversacion: cambio.doc.id },
                Number(idMiembros),
                { primeraFoto: esPrimeraFoto }
              )
            ) {
              sonarAviso('mensajeRecibido');
            }
          });

          if (esPrimeraFoto || !cambios.length) return;

          mutate((key) => isChatUnreadSummaryKey(key));
          mutate((key) => isConversationsKey(key));
        },
        (error) => console.error('[chat] no se pudo escuchar el buzón compartido', error)
      );
    });

    return () => cancelaciones.forEach((cancelar) => cancelar());
  }, [claves, enabled]);
}
