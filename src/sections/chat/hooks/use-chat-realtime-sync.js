import { mutate } from 'swr';
import { useRef, useEffect } from 'react';
import { doc, query, where, limit, orderBy, collection, onSnapshot } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  isConversationKey,
  isConversationsKey,
  syncRealtimeMessages,
  isChatUnreadSummaryKey,
  markConversationDelivered,
} from 'src/actions/chat';

import { getActiveTypingState, getConversationDeliveryMarker } from '../utils/realtime-sync.mjs';

// ----------------------------------------------------------------------

const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const SUBCOLECCION_MENSAJES = 'mensajes';
const DEBOUNCE_MS = 80;
const TYPING_STALE_MS = 15000;
const RECENT_MESSAGES_WINDOW = 50;
const RECENT_CONVERSATIONS_WINDOW = 100;

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
export function useChatRealtimeSync({
  enabled = true,
  idMiembros,
  conversationId,
  onTypingSnapshot,
}) {
  const typingTimeoutRef = useRef(null);
  const messagesInitializedRef = useRef(false);
  const deliveredMarkersRef = useRef(new Map());
  const conversationMarkersRef = useRef(new Map());
  const conversationRevisionRef = useRef('');
  const revalidateConversations = useDebouncedCallback(() => {
    mutate((key) => isConversationsKey(key));
    mutate((key) => isChatUnreadSummaryKey(key));
  }, DEBOUNCE_MS);

  const revalidateConversation = useDebouncedCallback(() => {
    if (!conversationId) return;
    mutate((key) => isConversationKey(key, conversationId));
  }, DEBOUNCE_MS);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured || !FIRESTORE || !idMiembros) return undefined;

    deliveredMarkersRef.current.clear();
    conversationMarkersRef.current.clear();

    const conversationsRef = collection(FIRESTORE, COLECCION_CONVERSACIONES);
    const viewerFilter = where('participantesIds', 'array-contains', Number(idMiembros));

    // Consulta preferida: acota la escucha a la ventana reciente, pero exige el
    // indice compuesto (participantesIds + eliminada + actualizadoEn) declarado en
    // firestore.indexes.json.
    const indexedQuery = query(
      conversationsRef,
      viewerFilter,
      where('eliminada', '==', false),
      orderBy('actualizadoEn', 'desc'),
      limit(RECENT_CONVERSATIONS_WINDOW)
    );

    // Reserva mientras ese indice no este publicado: `array-contains` por si sola
    // se resuelve con el indice de campo automatico. Escucha TODAS las
    // conversaciones del usuario y descarta las eliminadas en el handler.
    const fallbackQuery = query(conversationsRef, viewerFilter);

    const handleSnapshot = (snapshot) => {
      let shouldRevalidate = false;

      snapshot.docChanges().forEach((change) => {
        // Con la consulta de reserva, una conversacion eliminada llega como
        // 'modified' (no sale del resultado); se trata igual que un 'removed'.
        if (change.type === 'removed' || change.doc.data()?.eliminada === true) {
          deliveredMarkersRef.current.delete(change.doc.id);
          conversationMarkersRef.current.delete(change.doc.id);
          shouldRevalidate = true;
          return;
        }
        if (!['added', 'modified'].includes(change.type)) return;

        const conversation = change.doc.data();
        const conversationMarker = JSON.stringify([
          conversation.actualizadoEn,
          conversation.ultimoMensaje,
          conversation.nombreGrupo,
          conversation.avatarGrupoUrl,
          conversation.participantesIds,
          conversation.noLeidosPorIdMiembros?.[String(idMiembros)],
          conversation.silenciadoPorIdMiembros?.[String(idMiembros)],
        ]);
        const deliveryMarker = getConversationDeliveryMarker({
          conversation,
          currentMemberId: idMiembros,
        });

        if (conversationMarkersRef.current.get(change.doc.id) !== conversationMarker) {
          conversationMarkersRef.current.set(change.doc.id, conversationMarker);
          shouldRevalidate = true;
        }

        if (!deliveryMarker) return;

        if (deliveredMarkersRef.current.get(change.doc.id) === deliveryMarker) return;
        deliveredMarkersRef.current.set(change.doc.id, deliveryMarker);

        void markConversationDelivered(change.doc.id);
      });

      if (shouldRevalidate) revalidateConversations();
    };

    let active = true;
    let unsubscribe = () => {};

    const subscribe = (chatQuery, { allowFallback }) =>
      onSnapshot(chatQuery, handleSnapshot, (error) => {
        // `failed-precondition` = el indice compuesto todavia no esta publicado en
        // el proyecto. En vez de dejar el chat sin tiempo real (y con un error en
        // consola), se reintenta con la consulta que no lo necesita.
        if (allowFallback && error?.code === 'failed-precondition') {
          console.warn(
            '[chat] falta el indice compuesto de conversaciones; se escucha sin acotar la ventana. Publicalo con: firebase deploy --only firestore:indexes'
          );
          unsubscribe();
          if (!active) return;
          unsubscribe = subscribe(fallbackQuery, { allowFallback: false });
          return;
        }

        console.error('[chat] error en el listener de conversaciones', error);
      });

    unsubscribe = subscribe(indexedQuery, { allowFallback: true });

    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idMiembros]);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured || !FIRESTORE || !conversationId) return undefined;

    const conversationRef = doc(FIRESTORE, COLECCION_CONVERSACIONES, String(conversationId));
    const messagesQuery = query(
      collection(conversationRef, SUBCOLECCION_MENSAJES),
      orderBy('enviadoEn', 'desc'),
      limit(RECENT_MESSAGES_WINDOW)
    );
    const receiptsQuery = query(collection(conversationRef, 'recibos'));

    messagesInitializedRef.current = false;
    conversationRevisionRef.current = '';

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const allowInsert = messagesInitializedRef.current;
        const changes = snapshot.docChanges().map((change) => ({
          id: change.doc.id,
          type: change.type,
          data: change.doc.data(),
        }));

        syncRealtimeMessages(conversationId, changes, { allowInsert }).catch((error) => {
          console.error('[chat] no se pudo aplicar el cambio de mensaje en tiempo real', error);
        });
        messagesInitializedRef.current = true;
        revalidateConversation();
      },
      (error) => {
        console.error('[chat] error en el listener de mensajes', error);
      }
    );
    const unsubscribeReceipts = onSnapshot(receiptsQuery, revalidateConversation, (error) => {
      console.error('[chat] error en el listener de recibos', error);
    });

    const unsubscribeConversation = onSnapshot(
      conversationRef,
      (snapshot) => {
        const conversation = snapshot.data() ?? {};
        const revision = JSON.stringify([
          conversation.actualizadoEn,
          conversation.ultimoMensaje,
          conversation.participantesIds,
          conversation.nombreGrupo,
          conversation.avatarGrupoUrl,
          conversation.administradoresIds,
          conversation.noLeidosPorIdMiembros?.[String(idMiembros)],
          conversation.silenciadoPorIdMiembros?.[String(idMiembros)],
        ]);

        if (revision !== conversationRevisionRef.current) {
          conversationRevisionRef.current = revision;
          revalidateConversation();
        }

        const publishTypingState = () => {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

          const typingState = getActiveTypingState({
            typingByMember: conversation.escribiendoPorIdMiembros,
            currentMemberId: idMiembros,
            staleMs: TYPING_STALE_MS,
          });

          onTypingSnapshot?.(typingState.ids);
          typingTimeoutRef.current = typingState.expiresIn
            ? setTimeout(publishTypingState, typingState.expiresIn + 25)
            : null;
        };

        publishTypingState();
      },
      (error) => {
        console.error('[chat] error en el listener de la conversación', error);
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeReceipts();
      unsubscribeConversation();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTypingSnapshot?.([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, enabled, idMiembros]);
}
