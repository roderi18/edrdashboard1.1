'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';

import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  useGetContacts,
  clickConversation,
  useGetConversation,
  useGetConversations,
} from 'src/actions/chat';

import { EmptyContent } from 'src/components/empty-content';

import { ChatNav } from '../chat-nav';
import { ChatLayout } from '../layout';
import { ChatRoom } from '../chat-room';
import { ChatMessageList } from '../chat-message-list';
import { ChatMessageInput } from '../chat-message-input';
import { ChatHeaderDetails } from '../chat-header-details';
import { ChatHeaderCompose } from '../chat-header-compose';
import { useCollapseNav } from '../hooks/use-collapse-nav';
import { useChatCurrentContact } from '../hooks/use-chat-current-contact';

// ----------------------------------------------------------------------

const isSameMember = (participant, currentContact) =>
  [participant?.idMiembros, participant?.id]
    .filter(Boolean)
    .some((value) => String(value) === String(currentContact?.idMiembros ?? currentContact?.id));

export function ChatView() {
  const router = useRouter();

  const { contacts } = useGetContacts();
  const currentContact = useChatCurrentContact(contacts);

  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get('id') || '';

  const { conversations, conversationsLoading } = useGetConversations(currentContact.idMiembros);
  const { conversation, conversationError, conversationLoading } =
    useGetConversation(selectedConversationId, currentContact.idMiembros);

  const roomNav = useCollapseNav();
  const conversationsNav = useCollapseNav();

  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    if (!selectedConversationId) {
      startTransition(() => {
        router.push(paths.dashboard.chat);
      });
    }
  }, [conversationError, router, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !currentContact.idMiembros || !conversation?.unreadCount) {
      return;
    }

    clickConversation(selectedConversationId, currentContact.idMiembros).catch((error) => {
      console.error('[chat] no se pudo marcar la conversación como leída', error);
    });
  }, [conversation?.unreadCount, currentContact.idMiembros, selectedConversationId]);

  const handleAddRecipients = useCallback((selected) => {
    setRecipients(selected);
  }, []);

  const filteredParticipants = conversation
    ? conversation.participants.filter((participant) => !isSameMember(participant, currentContact))
    : [];

  return (
    <DashboardContent
      maxWidth={false}
      sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column' }}
    >
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Mensajes
      </Typography>

      <ChatLayout
        slots={{
          header: selectedConversationId ? (
            <ChatHeaderDetails
              collapseNav={roomNav}
              participants={filteredParticipants}
              loading={conversationLoading}
            />
          ) : (
            <ChatHeaderCompose contacts={contacts} onAddRecipients={handleAddRecipients} />
          ),
          nav: (
            <ChatNav
              contacts={contacts}
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              collapseNav={conversationsNav}
              loading={conversationsLoading}
            />
          ),
          main: (
            <>
              {selectedConversationId ? (
                conversationError ? (
                  <EmptyContent
                    title={conversationError.message}
                    imgUrl={`${CONFIG.assetsDir}/assets/icons/empty/ic-chat-empty.svg`}
                  />
                ) : (
                  <ChatMessageList
                    messages={conversation?.messages ?? []}
                    participants={conversation?.participants ?? []}
                    currentContact={currentContact}
                    loading={conversationLoading}
                  />
                )
              ) : (
                <EmptyContent
                  title="Selecciona una conversación"
                  description="Busca un contacto o escribe un mensaje nuevo."
                  imgUrl={`${CONFIG.assetsDir}/assets/icons/empty/ic-chat-active.svg`}
                />
              )}

              <ChatMessageInput
                recipients={recipients}
                currentContact={currentContact}
                onAddRecipients={handleAddRecipients}
                selectedConversationId={selectedConversationId}
                disabled={!recipients.length && !selectedConversationId}
              />
            </>
          ),
          details: conversation && selectedConversationId && (
            <ChatRoom
              collapseNav={roomNav}
              participants={filteredParticipants}
              loading={conversationLoading}
              messages={conversation?.messages ?? []}
            />
          ),
        }}
      />
    </DashboardContent>
  );
}
