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
    const data = { conversationId, messageData, idMiembros };
    const res = await axios.put(CHAT_ENDPOINT, data);
    serverConversation = res.data?.conversation ?? null;
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
