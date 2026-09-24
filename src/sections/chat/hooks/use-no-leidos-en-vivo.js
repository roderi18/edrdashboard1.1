import { useMemo, useState, useEffect } from 'react';
import { query, where, collection, onSnapshot } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LOS "NO LEÍDOS", EN VIVO, SIN PREGUNTAR AL SERVIDOR.
//
// Qué se rompía: el número del menú "Chats" y los círculos de las bandejas se
// pedían a `/api/chat?endpoint=unread-summary`: la persona y cada buzón que
// atiende, cada minuto y con cada cambio. Hasta el arreglo de los avisos llegaba
// a tardar 5-11 s; aun así, cada cambio costaba varias idas y vueltas.
//
// Cada conversación ya guarda cuántos mensajes tiene sin leer cada identidad
// (`noLeidosPorIdMiembros`). Aquí se escucha, por identidad (la persona y cada
// buzón), la misma consulta que usa el chat —`participantesIds` contiene el id—
// y se cuenta en el navegador. El número se mueve al instante, como en WhatsApp.
// Firestore comparte la escucha si otra pantalla abre la misma consulta, y con la
// caché persistente reabrir la app solo trae lo que cambió.
//
// `listo` es falso hasta que TODAS las identidades dieron su primera foto; y si
// una escucha falla (reglas, sin red), se queda en falso: quien lo usa sigue con
// el resumen del servidor, que no se ha quitado.
// ----------------------------------------------------------------------

const COLECCION_CONVERSACIONES = 'conversaciones_chat';

const noLeidosDe = (snapshot, idMiembros) => {
  const porConversacion = {};

  snapshot.docs.forEach((documento) => {
    const conversacion = documento.data();

    if (conversacion?.eliminada === true) return;

    const pendientes = Number(conversacion?.noLeidosPorIdMiembros?.[String(idMiembros)] ?? 0);

    if (pendientes > 0) porConversacion[documento.id] = pendientes;
  });

  return porConversacion;
};

export function useNoLeidosEnVivo(idsMiembros = [], enabled = true) {
  const clave = [...new Set(idsMiembros.map(Number).filter((id) => Number.isFinite(id) && id > 0))]
    .sort((a, b) => a - b)
    .join(',');
  const [estado, setEstado] = useState({ clave: '', porIdentidad: {}, fallidas: [] });

  useEffect(() => {
    if (!enabled || !clave || !isFirebaseConfigured || !FIRESTORE) return undefined;

    const ids = clave.split(',').map(Number);

    setEstado({ clave, porIdentidad: {}, fallidas: [] });

    const cancelaciones = ids.map((idMiembros) =>
      onSnapshot(
        query(
          collection(FIRESTORE, COLECCION_CONVERSACIONES),
          where('participantesIds', 'array-contains', idMiembros)
        ),
        (snapshot) => {
          setEstado((actual) =>
            actual.clave !== clave
              ? actual
              : {
                  ...actual,
                  porIdentidad: { ...actual.porIdentidad, [idMiembros]: noLeidosDe(snapshot, idMiembros) },
                }
          );
        },
        (error) => {
          console.warn('[chat] sin contador en vivo para', idMiembros, error?.code || error);
          setEstado((actual) =>
            actual.clave !== clave ? actual : { ...actual, fallidas: [...actual.fallidas, idMiembros] }
          );
        }
      )
    );

    return () => cancelaciones.forEach((cancelar) => cancelar());
  }, [clave, enabled]);

  return useMemo(() => {
    const ids = clave ? clave.split(',').map(Number) : [];
    const listo =
      enabled &&
      ids.length > 0 &&
      estado.clave === clave &&
      !estado.fallidas.length &&
      ids.every((id) => estado.porIdentidad[id]);

    return {
      listo,
      // Mismo reparto que el resumen del servidor: todas las identidades juntas.
      unreadByConversation: listo
        ? Object.assign({}, ...ids.map((id) => estado.porIdentidad[id]))
        : {},
      porIdentidad: estado.porIdentidad,
    };
  }, [clave, enabled, estado]);
}
