import { keyBy } from 'es-toolkit';
import useSWRInfinite from 'swr/infinite';
import { useMemo, useCallback } from 'react';
import useSWR, { mutate, preload } from 'swr';

import { esBuzonCompartido } from 'src/utils/chat-buzones.mjs';
import { toggleChatReaction } from 'src/utils/chat-reaction-core.mjs';

import axios, { fetcher, endpoints } from 'src/lib/axios';

import { mergeRealtimeMessageChanges } from 'src/sections/chat/utils/realtime-sync.mjs';

// ----------------------------------------------------------------------

const enableServer = true;

const CHAT_ENDPOINT =
  typeof window !== 'undefined' ? `${window.location.origin}${endpoints.chat}` : endpoints.chat;

const swrOptions = {
  revalidateIfStale: enableServer,
  revalidateOnFocus: enableServer,
  revalidateOnReconnect: enableServer,
};

const CHAT_CONTACTS_REFRESH_INTERVAL = 0;
const CHAT_CONVERSATIONS_PAGE_SIZE = 30;
// El paso del tiempo no produce eventos de Firestore. Los avisos de buzones que
// llevan una hora sin respuesta necesitan volver a consultar el resumen aunque
// nadie escriba otro mensaje. Un minuto mantiene el aviso cerca de la hora
// prevista; el servidor evita repetir notificaciones mediante IDs estables.
const CHAT_SHARED_MAILBOX_REMINDER_REFRESH_INTERVAL = 60_000;
// El polling ahora es solo una red de seguridad: el push en tiempo real
// (useChatRealtimeSync) es quien dispara la revalidación real vía mutate().
const CHAT_CONVERSATIONS_REFRESH_INTERVAL = 45000;
const CHAT_CONVERSATION_REFRESH_INTERVAL = 45000;

// ----------------------------------------------------------------------

const isChatKey = (key, endpoint) =>
  Array.isArray(key) && key[0] === CHAT_ENDPOINT && key[1]?.params?.endpoint === endpoint;

export const isConversationKey = (key, conversationId) =>
  isChatKey(key, 'conversation') &&
  String(key[1]?.params?.conversationId) === String(conversationId);

export const isConversationsKey = (key) => isChatKey(key, 'conversations');

export const isChatUnreadSummaryKey = (key) => isChatKey(key, 'unread-summary');

// `idMiembros` solo hace falta en el buzon de la Tienda: sin el, la lista se pedia
// como la persona, y quien atiende el buzon sin ficha de miembro se quedaba sin
// contactos.
export function useGetContacts(enabled = true, idMiembros = null) {
  const url = enabled
    ? [CHAT_ENDPOINT, { params: { endpoint: 'contacts', ...(idMiembros ? { idMiembros } : {}) } }]
    : '';

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
    refreshInterval: enabled && enableServer ? CHAT_CONTACTS_REFRESH_INTERVAL : 0,
  });

  const memoizedValue = useMemo(
    () => ({
      contacts: data?.contacts || [],
      contactsLoading: isLoading,
      contactsError: error,
      contactsValidating: isValidating,
      contactsEmpty: !isLoading && !isValidating && !data?.contacts.length,
    }),
    [data?.contacts, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetChatUnreadSummary(idMiembros, enabled = true) {
  const url =
    enabled && idMiembros
      ? [CHAT_ENDPOINT, { params: { endpoint: 'unread-summary', sessionMemberId: idMiembros } }]
      : '';

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
    // UN BUZON SE REPASA SOLO, COMO EN LA CABECERA. Su contador lo mueven otras
    // personas —quien atiende la Tienda y abre un mensaje se lo limpia a todos—,
    // y aqui solo lo refrescaba la escucha en vivo: si esa escucha se perdia un
    // cambio, el circulo seguia marcando pendiente algo que otro ya habia
    // abierto. El mismo minuto que ya usa el resumen de la cabecera.
    refreshInterval: esBuzonCompartido(idMiembros)
      ? CHAT_SHARED_MAILBOX_REMINDER_REFRESH_INTERVAL
      : 0,
  });

  return useMemo(
    () => ({
      unreadByConversation: data?.unreadByConversation ?? {},
      unreadConversationCount: Number(data?.unreadConversationCount ?? 0),
      unreadMessageCount: Number(data?.unreadMessageCount ?? 0),
      unreadSummaryLoading: isLoading,
      unreadSummaryError: error,
      unreadSummaryValidating: isValidating,
    }),
    [data, error, isLoading, isValidating]
  );
}

// ----------------------------------------------------------------------

// `precarga`: la usa el panel para dejar la lista lista antes de entrar al chat
// (ver `precarga-del-chat.jsx`). Solo llena la caché: sin repaso cada 45 s ni al
// volver a la ventana, que eso ya lo hace la pantalla de chat cuando se abre.
export function useGetConversations(idMiembros, enabled = true, { precarga = false } = {}) {
  const getKey = useCallback(
    (pageIndex, previousPageData) => {
      if (!enabled || !idMiembros) return null;
      if (pageIndex > 0 && !previousPageData?.hasMore) return null;

      return [
        CHAT_ENDPOINT,
        {
          params: {
            endpoint: 'conversations',
            idMiembros,
            limit: CHAT_CONVERSATIONS_PAGE_SIZE,
            ...(previousPageData?.nextCursor ? { cursor: previousPageData.nextCursor } : {}),
          },
        },
      ];
    },
    [enabled, idMiembros]
  );

  const { data, size, setSize, isLoading, error, isValidating } = useSWRInfinite(getKey, fetcher, {
    ...swrOptions,
    ...(precarga && { revalidateOnFocus: false, revalidateOnReconnect: false }),
    refreshInterval: enabled && enableServer && !precarga ? CHAT_CONVERSATIONS_REFRESH_INTERVAL : 0,
    revalidateFirstPage: true,
  });

  const memoizedValue = useMemo(() => {
    const mergedConversations = (data ?? []).flatMap((page) => page?.conversations ?? []);
    const byId = mergedConversations.length
      ? keyBy(mergedConversations, (option) => option.id)
      : {};
    const allIds = Object.keys(byId);
    const lastPage = data?.at(-1);

    return {
      conversations: { byId, allIds },
      conversationsHasMore: Boolean(lastPage?.hasMore),
      conversationsLoadingMore: isValidating && size > (data?.length ?? 0),
      conversationsLoading: isLoading,
      conversationsError: error,
      conversationsValidating: isValidating,
      conversationsEmpty: !isLoading && !isValidating && !allIds.length,
    };
  }, [data, error, isLoading, isValidating, size]);

  const loadMoreConversations = useCallback(() => setSize((current) => current + 1), [setSize]);

  return { ...memoizedValue, loadMoreConversations };
}

// ----------------------------------------------------------------------

const claveDeConversacion = (conversationId, idMiembros) => [
  CHAT_ENDPOINT,
  { params: { conversationId: `${conversationId}`, endpoint: 'conversation', idMiembros } },
];

/**
 * Adelanta una conversación (al pasar por encima o tocarla): al abrirla, los
 * mensajes ya están en la caché y salen al instante. SWR no la vuelve a pedir si
 * ya hay una petición en marcha para la misma clave.
 */
export function precargarConversacion(conversationId, idMiembros) {
  if (!conversationId) return;

  preload(claveDeConversacion(conversationId, idMiembros), fetcher).catch(() => {});
}

export function useGetConversation(conversationId, idMiembros) {
  const url = conversationId ? claveDeConversacion(conversationId, idMiembros) : '';

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
    refreshInterval: enableServer ? CHAT_CONVERSATION_REFRESH_INTERVAL : 0,
  });

  const memoizedValue = useMemo(
    () => ({
      conversation: data?.conversation,
      conversationLoading: isLoading,
      conversationError: error,
      conversationValidating: isValidating,
      conversationEmpty: !isLoading && !isValidating && !data?.conversation,
    }),
    [data?.conversation, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

// LO PENDIENTE DE LOS BUZONES COMPARTIDOS QUE ATIENDE ESTA SESION.
//
// El contador de "Chats" del menu solo contaba las conversaciones personales:
// quien atiende la Tienda o la Oficina no se enteraba de que alguien habia
// escrito hasta entrar al chat y abrir su bandeja. Una peticion por cada buzon,
// en una sola clave; `mutate` la revalida como a cualquier resumen porque su
// clave tambien es de 'unread-summary'.
export function useGetUnreadSummaryDeBuzones(idsMiembros = [], enabled = true) {
  const ids = idsMiembros.filter(Boolean).map(Number);
  const url =
    enabled && ids.length
      ? [CHAT_ENDPOINT, { params: { endpoint: 'unread-summary', buzones: ids.join(',') } }]
      : '';

  const { data } = useSWR(
    url,
    () =>
      Promise.all(
        ids.map((sessionMemberId) =>
          fetcher([CHAT_ENDPOINT, { params: { endpoint: 'unread-summary', sessionMemberId } }]).catch(
            () => null
          )
        )
      ),
    {
      ...swrOptions,
      refreshInterval: CHAT_SHARED_MAILBOX_REMINDER_REFRESH_INTERVAL,
      refreshWhenHidden: true,
    }
  );

  return useMemo(() => {
    const resumenes = Array.isArray(data) ? data.filter(Boolean) : [];

    return {
      unreadByConversation: Object.assign(
        {},
        ...resumenes.map((resumen) => resumen?.unreadByConversation ?? {})
      ),
    };
  }, [data]);
}

// ----------------------------------------------------------------------

export async function sendMessage(conversationId, messageData, idMiembros) {
  const conversationsUrl = [CHAT_ENDPOINT, { params: { endpoint: 'conversations', idMiembros } }];

  const conversationUrl = [
    CHAT_ENDPOINT,
    { params: { conversationId, endpoint: 'conversation', idMiembros } },
  ];
  let serverConversation = null;
  const optimisticMessage = { ...messageData, estadoEnvio: 'enviando' };

  const addOptimisticMessage = (messages = []) =>
    messages.some((message) => message.id === optimisticMessage.id)
      ? messages
      : [...messages, optimisticMessage];
  const replaceOptimisticMessage = (messages = []) =>
    messages.map((message) =>
      message.id === optimisticMessage.id ? { ...message, estadoEnvio: 'enviado' } : message
    );

  const updateConversationCache = ({ currentData, optimistic = false }) => {
    if (serverConversation) {
      return { ...(currentData ?? {}), conversation: serverConversation };
    }

    if (!currentData?.conversation) {
      return currentData;
    }

    const currentConversation = currentData.conversation;

    const conversation = {
      ...currentConversation,
      messages: optimistic
        ? addOptimisticMessage(currentConversation.messages)
        : replaceOptimisticMessage(currentConversation.messages),
    };

    return { ...currentData, conversation };
  };

  const updateConversationsCache = ({ currentData, optimistic = false }) => {
    if (!currentData?.conversations) {
      return currentData;
    }

    const currentConversations = currentData.conversations;

    const conversations = currentConversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...(serverConversation ?? conversation),
            messages:
              serverConversation?.messages ??
              (optimistic
                ? addOptimisticMessage(conversation.messages)
                : replaceOptimisticMessage(conversation.messages)),
          }
        : conversation
    );

    return { ...currentData, conversations };
  };

  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) => updateConversationCache({ currentData, optimistic: true }),
    { revalidate: false }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) => updateConversationsCache({ currentData, optimistic: true }),
    { revalidate: false }
  );

  await mutate(
    conversationUrl,
    (currentData) => updateConversationCache({ currentData, optimistic: true }),
    { revalidate: false }
  );

  await mutate(
    conversationsUrl,
    (currentData) => updateConversationsCache({ currentData, optimistic: true }),
    { revalidate: false }
  );

  /**
   * Work on server
   */
  if (enableServer) {
    try {
      const data = { conversationId, messageData, idMiembros };
      const res = await axios.put(CHAT_ENDPOINT, data);
      serverConversation = res.data?.conversation ?? null;
    } catch (error) {
      await removeLocalMessage(conversationId, optimisticMessage.id);
      throw error;
    }
  }

  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) => updateConversationCache({ currentData }),
    { revalidate: false }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) => updateConversationsCache({ currentData }),
    { revalidate: false }
  );

  mutate((key) => isConversationKey(key, conversationId));
  mutate((key) => isConversationsKey(key));

  return serverConversation;
}

// ----------------------------------------------------------------------

export async function addLocalMessage(conversationId, messageData) {
  const localMessage = { ...messageData, estadoEnvio: messageData.estadoEnvio ?? 'enviando' };

  const addMessage = (messages = []) =>
    messages.some((message) => message.id === localMessage.id)
      ? messages
      : [...messages, localMessage];

  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) => {
      if (!currentData?.conversation) return currentData;

      return {
        ...currentData,
        conversation: {
          ...currentData.conversation,
          messages: addMessage(currentData.conversation.messages),
        },
      };
    },
    { revalidate: false }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) => {
      if (!currentData?.conversations) return currentData;

      return {
        ...currentData,
        conversations: currentData.conversations.map((conversation) =>
          String(conversation.id) === String(conversationId)
            ? { ...conversation, messages: addMessage(conversation.messages) }
            : conversation
        ),
      };
    },
    { revalidate: false }
  );
}

// ----------------------------------------------------------------------

export async function removeLocalMessage(conversationId, messageId) {
  const removeMessage = (messages = []) =>
    messages.filter((message) => String(message.id) !== String(messageId));

  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) =>
      currentData?.conversation
        ? {
            ...currentData,
            conversation: {
              ...currentData.conversation,
              messages: removeMessage(currentData.conversation.messages),
            },
          }
        : currentData,
    { revalidate: false }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) =>
      currentData?.conversations
        ? {
            ...currentData,
            conversations: currentData.conversations.map((conversation) =>
              String(conversation.id) === String(conversationId)
                ? { ...conversation, messages: removeMessage(conversation.messages) }
                : conversation
            ),
          }
        : currentData,
    { revalidate: false }
  );
}

// ----------------------------------------------------------------------

export async function createConversation(conversationData, idMiembros) {
  // `idMiembros` viaja para que el servidor sepa si se escribe desde el buzon de
  // la Tienda. No dice quien eres: eso sale del token.
  const data = { conversationData, idMiembros };
  const res = await axios.post(CHAT_ENDPOINT, data);
  const conversation = res.data?.conversation;

  // LA CONVERSACION RECIEN CREADA YA LA TENEMOS: NO SE VUELVE A PEDIR.
  //
  // Al enviar el primer mensaje se navegaba a `?id=<nueva>` y la pantalla se
  // ponia a cargarla desde cero: el chat entero se llenaba de esqueletos grises
  // durante un segundo, solo para acabar enseñando el mensaje que se acababa de
  // escribir. Y el servidor ya la habia devuelto entera en esta misma respuesta.
  //
  // Se guarda en la cache con su clave antes de navegar, asi que al llegar ya
  // esta ahi y no hay nada que cargar.
  if (conversation?.id) {
    await mutate(
      [
        CHAT_ENDPOINT,
        {
          params: {
            conversationId: `${conversation.id}`,
            endpoint: 'conversation',
            idMiembros,
          },
        },
      ],
      { conversation },
      { revalidate: false }
    );
  }

  await mutate((key) => isConversationsKey(key));

  return res.data;
}

export async function discardEmptyConversation(conversationId, idMiembros) {
  if (!conversationId) return null;

  const res = await axios.patch(CHAT_ENDPOINT, {
    action: 'discard-empty',
    conversationId,
    idMiembros,
  });

  mutate((key) => isConversationKey(key, conversationId), undefined, { revalidate: false });
  mutate((key) => isConversationsKey(key));

  return res.data?.conversation ?? null;
}

// ----------------------------------------------------------------------

export async function clickConversation(conversationId, idMiembros) {
  /**
   * Work on server
   */
  if (enableServer) {
    await axios.get(CHAT_ENDPOINT, {
      params: { conversationId, endpoint: 'mark-as-seen', idMiembros },
    });

    // Los contadores, al momento. Solo se tocaba la lista de conversaciones, asi
    // que el circulo y la cabecera de quien acababa de abrirlo seguian marcando
    // pendiente hasta la siguiente vuelta.
    mutate((key) => isChatUnreadSummaryKey(key));
  }

  /**
   * Work in local
   */
  mutate(
    [CHAT_ENDPOINT, { params: { endpoint: 'conversations', idMiembros } }],
    (currentData) => {
      if (!currentData?.conversations) {
        return currentData;
      }

      const currentConversations = currentData.conversations;

      const conversations = currentConversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      );

      return { ...currentData, conversations };
    },
    false
  );

  mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) => {
      if (!currentData?.conversation) {
        return currentData;
      }

      return {
        ...currentData,
        conversation: { ...currentData.conversation, unreadCount: 0 },
      };
    },
    { revalidate: false }
  );
}

// ----------------------------------------------------------------------

const updateMessageInConversation = (conversation, messageId, updater) => {
  if (!conversation?.messages) {
    return conversation;
  }

  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      String(message.id) === String(messageId) ? updater(message) : message
    ),
  };
};

const mutateConversationMessage = async ({
  conversationId,
  messageId,
  updater,
  revalidate = false,
}) => {
  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) => {
      if (!currentData?.conversation) return currentData;

      return {
        ...currentData,
        conversation: updateMessageInConversation(currentData.conversation, messageId, updater),
      };
    },
    { revalidate }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) => {
      if (!currentData?.conversations) return currentData;

      return {
        ...currentData,
        conversations: currentData.conversations.map((conversation) =>
          String(conversation.id) === String(conversationId)
            ? updateMessageInConversation(conversation, messageId, updater)
            : conversation
        ),
      };
    },
    { revalidate }
  );
};

export async function syncRealtimeMessages(conversationId, changes, { allowInsert = true } = {}) {
  const updateMessages = (conversation) => {
    if (!conversation?.messages) return conversation;

    return {
      ...conversation,
      messages: mergeRealtimeMessageChanges({
        messages: conversation.messages,
        changes,
        allowInsert,
      }),
    };
  };

  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) =>
      currentData?.conversation
        ? { ...currentData, conversation: updateMessages(currentData.conversation) }
        : currentData,
    { revalidate: false }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) => {
      if (!currentData?.conversations) return currentData;

      return {
        ...currentData,
        conversations: currentData.conversations.map((conversation) =>
          String(conversation.id) === String(conversationId)
            ? updateMessages(conversation)
            : conversation
        ),
      };
    },
    { revalidate: false }
  );
}

const mutateConversationAction = async ({ conversationId, request }) => {
  const res = await request();
  const serverConversation = res.data?.conversation ?? null;

  if (serverConversation) {
    await mutate(
      (key) => isConversationKey(key, conversationId),
      (currentData) => ({ ...(currentData ?? {}), conversation: serverConversation }),
      { revalidate: false }
    );

    await mutate(
      (key) => isConversationsKey(key),
      (currentData) => {
        if (!currentData?.conversations) return currentData;

        return {
          ...currentData,
          conversations: currentData.conversations.map((conversation) =>
            conversation.id === conversationId ? serverConversation : conversation
          ),
        };
      },
      { revalidate: false }
    );
  }

  mutate((key) => isConversationKey(key, conversationId));
  mutate((key) => isConversationsKey(key));

  return serverConversation;
};

export async function reactMessage(conversationId, messageId, idMiembros, reaction = '\u{1F44D}') {
  const reactionKey = String(idMiembros || 'usuario');

  await mutateConversationMessage({
    conversationId,
    messageId,
    updater: (message) => {
      const currentReactions = message.reactions || {};
      const nextReactions = toggleChatReaction(currentReactions, reactionKey, reaction);

      return { ...message, reactions: nextReactions };
    },
  });

  try {
    return await mutateConversationAction({
      conversationId,
      request: () =>
        axios.patch(CHAT_ENDPOINT, {
          action: 'react',
          conversationId,
          messageId,
          idMiembros,
          reaction,
        }),
    });
  } catch (error) {
    mutate((key) => isConversationKey(key, conversationId));
    mutate((key) => isConversationsKey(key));
    throw error;
  }
}
export async function deleteMessage(conversationId, messageId, idMiembros) {
  await mutateConversationMessage({
    conversationId,
    messageId,
    updater: (message) => ({
      ...message,
      eliminado: true,
      body: 'Mensaje eliminado',
      textoOriginal: message.textoOriginal ?? message.body,
      bodyOriginal: message.bodyOriginal ?? message.body,
      contentTypeOriginal: message.contentTypeOriginal ?? message.contentType,
      attachmentsOriginal: message.attachmentsOriginal ?? message.attachments,
      reactions: {},
    }),
  });

  try {
    return await mutateConversationAction({
      conversationId,
      request: () =>
        axios.patch(CHAT_ENDPOINT, {
          action: 'delete',
          conversationId,
          messageId,
          idMiembros,
        }),
    });
  } catch (error) {
    mutate((key) => isConversationKey(key, conversationId));
    mutate((key) => isConversationsKey(key));
    throw error;
  }
}

export async function restoreMessage(conversationId, messageId, idMiembros) {
  await mutateConversationMessage({
    conversationId,
    messageId,
    updater: (message) => ({
      ...message,
      eliminado: false,
      body: message.bodyOriginal ?? message.textoOriginal ?? message.body,
      contentType: message.contentTypeOriginal ?? message.contentType,
      attachments: message.attachmentsOriginal ?? message.attachments,
    }),
  });

  try {
    return await mutateConversationAction({
      conversationId,
      request: () =>
        axios.patch(CHAT_ENDPOINT, {
          action: 'restore',
          conversationId,
          messageId,
          idMiembros,
        }),
    });
  } catch (error) {
    mutate((key) => isConversationKey(key, conversationId));
    mutate((key) => isConversationsKey(key));
    throw error;
  }
}

export async function editMessage(conversationId, messageId, text, idMiembros) {
  await mutateConversationMessage({
    conversationId,
    messageId,
    updater: (message) => ({
      ...message,
      body: text,
      editado: true,
    }),
  });

  try {
    return await mutateConversationAction({
      conversationId,
      request: () =>
        axios.patch(CHAT_ENDPOINT, {
          action: 'edit',
          conversationId,
          messageId,
          idMiembros,
          text,
        }),
    });
  } catch (error) {
    mutate((key) => isConversationKey(key, conversationId));
    mutate((key) => isConversationsKey(key));
    throw error;
  }
}

const mutateConversation = async ({ conversationId, updater, revalidate = false }) => {
  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) => {
      if (!currentData?.conversation) return currentData;

      return { ...currentData, conversation: updater(currentData.conversation) };
    },
    { revalidate }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) => {
      if (!currentData?.conversations) return currentData;

      return {
        ...currentData,
        conversations: currentData.conversations.map((conversation) =>
          String(conversation.id) === String(conversationId) ? updater(conversation) : conversation
        ),
      };
    },
    { revalidate }
  );
};

export async function toggleMuteConversation(conversationId, idMiembros) {
  await mutateConversation({
    conversationId,
    updater: (conversation) => ({ ...conversation, muted: !conversation.muted }),
  });

  try {
    return await mutateConversationAction({
      conversationId,
      request: () =>
        axios.patch(CHAT_ENDPOINT, {
          action: 'toggle-mute',
          conversationId,
          idMiembros,
        }),
    });
  } catch (error) {
    mutate((key) => isConversationKey(key, conversationId));
    mutate((key) => isConversationsKey(key));
    throw error;
  }
}

export async function reportConversation(conversationId, idMiembros, comment) {
  return mutateConversationAction({
    conversationId,
    request: () =>
      axios.patch(CHAT_ENDPOINT, {
        action: 'report',
        conversationId,
        idMiembros,
        comment,
      }),
  });
}

export async function setTyping(conversationId, idMiembros, isTyping = true) {
  try {
    await axios.patch(CHAT_ENDPOINT, {
      action: 'typing',
      conversationId,
      idMiembros,
      isTyping,
    });
  } catch (error) {
    // Best-effort: un fallo al anunciar "escribiendo" no debe interrumpir al usuario.
    console.warn('[chat] no se pudo anunciar el estado de escritura', error?.message ?? error);
  }
}

// ----------------------------------------------------------------------

export async function loadOlderMessages(conversationId, oldestTimestamp, idMiembros) {
  const res = await axios.get(CHAT_ENDPOINT, {
    params: {
      endpoint: 'older-messages',
      conversationId,
      before: oldestTimestamp,
      idMiembros,
    },
  });

  const olderMessages = res.data?.messages ?? [];

  const prependMessages = (messages = []) => {
    const existingIds = new Set(messages.map((message) => message.id));
    const uniqueOlder = olderMessages.filter((message) => !existingIds.has(message.id));

    return [...uniqueOlder, ...messages];
  };

  await mutate(
    (key) => isConversationKey(key, conversationId),
    (currentData) => {
      if (!currentData?.conversation) return currentData;

      return {
        ...currentData,
        conversation: {
          ...currentData.conversation,
          messages: prependMessages(currentData.conversation.messages),
        },
      };
    },
    { revalidate: false }
  );

  await mutate(
    (key) => isConversationsKey(key),
    (currentData) => {
      if (!currentData?.conversations) return currentData;

      return {
        ...currentData,
        conversations: currentData.conversations.map((conversation) =>
          String(conversation.id) === String(conversationId)
            ? { ...conversation, messages: prependMessages(conversation.messages) }
            : conversation
        ),
      };
    },
    { revalidate: false }
  );

  return { hasMore: olderMessages.length >= 30 };
}

// ----------------------------------------------------------------------

export async function addParticipants(
  conversationId,
  idMiembros,
  newParticipants,
  historyVisibility = 'none'
) {
  return mutateConversationAction({
    conversationId,
    request: () =>
      axios.patch(CHAT_ENDPOINT, {
        action: 'add-participants',
        conversationId,
        idMiembros,
        newParticipants,
        historyVisibility,
      }),
  });
}

export async function removeParticipant(conversationId, idMiembros, targetIdMiembros) {
  return mutateConversationAction({
    conversationId,
    request: () =>
      axios.patch(CHAT_ENDPOINT, {
        action: 'remove-participant',
        conversationId,
        idMiembros,
        targetIdMiembros,
      }),
  });
}

export async function leaveGroup(conversationId, idMiembros) {
  return mutateConversationAction({
    conversationId,
    request: () =>
      axios.patch(CHAT_ENDPOINT, { action: 'leave-group', conversationId, idMiembros }),
  });
}

export async function markConversationDelivered(conversationId, idMiembros) {
  if (!conversationId) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.patch(CHAT_ENDPOINT, {
        action: 'mark-delivered',
        conversationId,
        idMiembros,
      });

      return response.data?.conversation ?? null;
    } catch (error) {
      if (attempt === 2) {
        console.warn('[chat] no se pudo confirmar la entrega', error?.message ?? error);
        return null;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 250 * (attempt + 1));
      });
    }
  }

  return null;
}

export async function transferGroupOwnership(conversationId, idMiembros, targetIdMiembros) {
  return mutateConversationAction({
    conversationId,
    request: () =>
      axios.patch(CHAT_ENDPOINT, {
        action: 'transfer-ownership',
        conversationId,
        idMiembros,
        targetIdMiembros,
      }),
  });
}

export async function setGroupAdministrator(
  conversationId,
  idMiembros,
  administratorIdMiembros,
  makeAdmin
) {
  return mutateConversationAction({
    conversationId,
    request: () =>
      axios.patch(CHAT_ENDPOINT, {
        action: 'set-group-admin',
        conversationId,
        idMiembros,
        administratorIdMiembros,
        makeAdmin,
      }),
  });
}

export async function updateGroupDetails(
  conversationId,
  idMiembros,
  groupName,
  groupAvatarUrl = ''
) {
  await mutateConversation({
    conversationId,
    updater: (conversation) => ({ ...conversation, groupName, groupAvatarUrl }),
  });

  try {
    return await mutateConversationAction({
      conversationId,
      request: () =>
        axios.patch(CHAT_ENDPOINT, {
          action: 'update-group',
          conversationId,
          idMiembros,
          groupName,
          groupAvatarUrl,
        }),
    });
  } catch (error) {
    mutate((key) => isConversationKey(key, conversationId));
    mutate((key) => isConversationsKey(key));
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function clearConversation(conversationId, idMiembros) {
  await mutateConversation({
    conversationId,
    updater: (conversation) => ({
      ...conversation,
      messages: [],
      unreadCount: 0,
    }),
  });

  try {
    return await mutateConversationAction({
      conversationId,
      request: () =>
        axios.patch(CHAT_ENDPOINT, {
          action: 'clear',
          conversationId,
          idMiembros,
        }),
    });
  } catch (error) {
    mutate((key) => isConversationKey(key, conversationId));
    mutate((key) => isConversationsKey(key));
    throw error;
  }
}

export async function clearConversationGlobally(conversationId, idMiembros) {
  return mutateConversationAction({
    conversationId,
    request: () =>
      axios.patch(CHAT_ENDPOINT, {
        action: 'clear-global',
        conversationId,
        idMiembros,
      }),
  });
}
