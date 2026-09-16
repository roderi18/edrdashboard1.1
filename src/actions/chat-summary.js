import useSWR from 'swr';
import { useMemo } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';

// Este módulo se mantiene pequeño a propósito. El layout global solo necesita
// el contador; importar `src/actions/chat` también arrastraba conversaciones,
// mensajes, reacciones y sincronización que pertenecen a la pantalla /chat.
const CHAT_ENDPOINT =
  typeof window !== 'undefined' ? `${window.location.origin}${endpoints.chat}` : endpoints.chat;

const SUMMARY_REFRESH_INTERVAL = 60_000;

export function useGetDashboardChatSummary({ memberId, mailboxIds = [], enabled = true }) {
  const identityIds = useMemo(
    () =>
      [
        ...new Set(
          [memberId, ...mailboxIds].map(Number).filter((id) => Number.isFinite(id) && id > 0)
        ),
      ].sort((a, b) => a - b),
    [mailboxIds, memberId]
  );
  const identityKey = identityIds.join(',');
  const url =
    enabled && identityKey
      ? [CHAT_ENDPOINT, { params: { endpoint: 'unread-summary', sessionMemberIds: identityKey } }]
      : null;

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    revalidateIfStale: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: SUMMARY_REFRESH_INTERVAL,
    refreshWhenHidden: false,
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
