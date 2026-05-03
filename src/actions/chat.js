import { useMemo } from 'react';
import { keyBy } from 'es-toolkit';
import useSWR, { mutate } from 'swr';

import axios, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const enableServer = true;

const CHAT_ENDPOINT =
  typeof window !== 'undefined' ? `${window.location.origin}${endpoints.chat}` : endpoints.chat;

const swrOptions = {
  revalidateIfStale: enableServer,
  revalidateOnFocus: enableServer,
  revalidateOnReconnect: enableServer,
};

// ----------------------------------------------------------------------

const isChatKey = (key, endpoint) =>
  Array.isArray(key) && key[0] === CHAT_ENDPOINT && key[1]?.params?.endpoint === endpoint;

const isConversationKey = (key, conversationId) =>
  isChatKey(key, 'conversation') && String(key[1]?.params?.conversationId) === String(conversationId);

const isConversationsKey = (key) => isChatKey(key, 'conversations');

export function useGetContacts() {
  const url = [CHAT_ENDPOINT, { params: { endpoint: 'contacts' } }];

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
    refreshInterval: enableServer ? 1500 : 0,
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

export function useGetConversations(idMiembros) {
  const url = idMiembros
    ? [CHAT_ENDPOINT, { params: { endpoint: 'conversations', idMiembros } }]
    : '';

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
    refreshInterval: enableServer ? 1500 : 0,
  });

  const memoizedValue = useMemo(() => {
    const byId = data?.conversations.length ? keyBy(data.conversations, (option) => option.id) : {};
    const allIds = Object.keys(byId);

    return {
      conversations: { byId, allIds },
      conversationsLoading: isLoading,
      conversationsError: error,
      conversationsValidating: isValidating,
      conversationsEmpty: !isLoading && !isValidating && !allIds.length,
    };
  }, [data?.conversations, error, isLoading, isValidating]);

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetConversation(conversationId, idMiembros) {
  const url = conversationId
    ? [
        CHAT_ENDPOINT,
        { params: { conversationId: `${conversationId}`, endpoint: 'conversation', idMiembros } },
      ]
    : '';

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
    refreshInterval: enableServer ? 1500 : 0,
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

export async function sendMessage(conversationId, messageData, idMiembros) {
  const conversationsUrl = [
    CHAT_ENDPOINT,
    { params: { endpoint: 'conversations', idMiembros } },
  ];

  const conversationUrl = [
    CHAT_ENDPOINT,
    { params: { conversationId, endpoint: 'conversation', idMiembros } },
  ];
  let serverConversation = null;

  /**
   * Work on server
   */
  if (enableServer) {
    const data = { conversationId, messageData, idMiembros };
    const res = await axios.put(CHAT_ENDPOINT, data);
    serverConversation = res.data?.conversation ?? null;
  }

  /**
   * Work in local
   */
  const updateConversationCache = (currentData) => {
    if (serverConversation) {
      return { ...(currentData ?? {}), conversation: serverConversation };
    }

    if (!currentData?.conversation) {
      return currentData;
    }

    const currentConversation = currentData.conversation;

    const conversation = {
      ...currentConversation,
      messages: [...(currentConversation.messages ?? []), messageData],
    };

    return { ...currentData, conversation };
  };

  const updateConversationsCache = (currentData) => {
    if (!currentData?.conversations) {
      return currentData;
    }

    const currentConversations = currentData.conversations;

    const conversations = currentConversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...(serverConversation ?? conversation),
            messages:
              serverConversation?.messages ?? [...(conversation.messages ?? []), messageData],
          }
        : conversation
    );

    return { ...currentData, conversations };
  };

  await mutate(
    (key) => isConversationKey(key, conversationId),
    updateConversationCache,
    { revalidate: false }
  );

  await mutate(
    (key) => isConversationsKey(key),
    updateConversationsCache,
    { revalidate: false }
  );

  await mutate(
    conversationUrl,
    updateConversationCache,
    { revalidate: false }
  );

  await mutate(
    conversationsUrl,
    updateConversationsCache,
    { revalidate: false }
  );

  mutate((key) => isConversationKey(key, conversationId));
  mutate((key) => isConversationsKey(key));

  return serverConversation;
}

// ----------------------------------------------------------------------

export async function createConversation(conversationData, idMiembros) {
  const url = [CHAT_ENDPOINT, { params: { endpoint: 'conversations', idMiembros } }];

  /**
   * Work on server
   */
  const data = { conversationData };
  const res = await axios.post(CHAT_ENDPOINT, data);
  const createdConversation = res.data?.conversation ?? conversationData;

  /**
   * Work in local
   */
  mutate(
    url,
    (currentData) => {
      if (!currentData?.conversations) {
        return currentData;
      }

      const currentConversations = currentData.conversations;

      const conversations = [...currentConversations, createdConversation];

      return { ...currentData, conversations };
    },
    false
  );

  return res.data;
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
}
