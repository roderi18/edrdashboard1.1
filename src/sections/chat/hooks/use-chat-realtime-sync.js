import { mutate } from 'swr';
import { useRef, useEffect } from 'react';
import { doc, query, where, limit, orderBy, collection, onSnapshot } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  isConversationKey,
  isConversationsKey,
  isChatUnreadSummaryKey,
  markConversationDelivered,
} from 'src/actions/chat';

// ----------------------------------------------------------------------

const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const SUBCOLECCION_MENSAJES = 'mensajes';
const DEBOUNCE_MS = 250;
const TYPING_STALE_MS = 5000;
const RECENT_MESSAGES_WINDOW = 50;

function useDebouncedCallback(callback, delay) {
  const timeoutRef = useRef(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  return (...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  };
}

/**
 * Usa onSnapshot de Firestore solo como disparador de revalidación: al detectar
 * un cambio, fuerza un refetch vía la API existente (mutate), que sigue siendo
 * la única fuente de verdad (permisos, enriquecimiento de participantes, etc.).
 */
export function useChatRealtimeSync({ idMiembros, conversationId, onTypingSnapshot }) {
  const revalidateConversations = useDebouncedCallback(() => {
    mutate((key) => isConversationsKey(key));
    mutate((key) => isChatUnreadSummaryKey(key));
  }, DEBOUNCE_MS);

  const revalidateConversation = useDebouncedCallback(() => {
    if (!conversationId) return;
    mutate((key) => isConversationKey(key, conversationId));
  }, DEBOUNCE_MS);

  useEffect(() => {
    if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return undefined;

    const conversationsQuery = query(
      collection(FIRESTORE, COLECCION_CONVERSACIONES),
      where('participantesIds', 'array-contains', Number(idMiembros)),
      where('eliminada', '==', false)
    );

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        revalidateConversations();

        snapshot.docChanges().forEach((change) => {
          if (!['added', 'modified'].includes(change.type)) return;

          markConversationDelivered(change.doc.id).catch((error) => {
            console.error('[chat] no se pudo confirmar la entrega de la conversación', error);
          });
        });
      },
      (error) => {
        console.error('[chat] error en el listener de conversaciones', error);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idMiembros]);

  useEffect(() => {
    if (!isFirebaseConfigured || !FIRESTORE || !conversationId) return undefined;

    const conversationRef = doc(FIRESTORE, COLECCION_CONVERSACIONES, String(conversationId));
    const messagesQuery = query(
      collection(conversationRef, SUBCOLECCION_MENSAJES),
      orderBy('enviadoEn', 'desc'),
      limit(RECENT_MESSAGES_WINDOW)
    );
    const receiptsQuery = query(collection(conversationRef, 'recibos'));

    const unsubscribeMessages = onSnapshot(messagesQuery, revalidateConversation, (error) => {
      console.error('[chat] error en el listener de mensajes', error);
    });
    const unsubscribeReceipts = onSnapshot(receiptsQuery, revalidateConversation, (error) => {
      console.error('[chat] error en el listener de recibos', error);
    });

    const unsubscribeConversation = onSnapshot(
      conversationRef,
      (snapshot) => {
        revalidateConversation();

        const escribiendoPorIdMiembros = snapshot.data()?.escribiendoPorIdMiembros ?? {};
        const now = Date.now();
        const typingIds = Object.entries(escribiendoPorIdMiembros)
          .filter(([id, timestamp]) => {
            const time = new Date(timestamp).getTime();
            return Number(id) !== Number(idMiembros) && now - time < TYPING_STALE_MS;
          })
          .map(([id]) => id);

        onTypingSnapshot?.(typingIds);
      },
      (error) => {
        console.error('[chat] error en el listener de la conversación', error);
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeReceipts();
      unsubscribeConversation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, idMiembros]);
}
