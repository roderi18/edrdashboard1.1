'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';

import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  reactMessage,
  deleteMessage,
  restoreMessage,
  useGetContacts,
  addParticipants,
  clickConversation,
  loadOlderMessages,
  clearConversation,
  removeParticipant,
  reportConversation,
  useGetConversation,
  useGetConversations,
  toggleMuteConversation,
} from 'src/actions/chat';

import { EmptyContent } from 'src/components/empty-content';

import { useAuthContext } from 'src/auth/hooks';

import { ChatNav } from '../chat-nav';
import { ChatLayout } from '../layout';
import { ChatRoom } from '../chat-room';
import { ChatMessageList } from '../chat-message-list';
import { ChatMessageInput } from '../chat-message-input';
import { ChatHeaderDetails } from '../chat-header-details';
import { ChatHeaderCompose } from '../chat-header-compose';
import { useCollapseNav } from '../hooks/use-collapse-nav';
import { useChatRealtimeSync } from '../hooks/use-chat-realtime-sync';
import { useChatCurrentContact } from '../hooks/use-chat-current-contact';

// ----------------------------------------------------------------------

const isSameMember = (participant, currentContact) =>
  [participant?.idMiembros, participant?.id]
    .filter(Boolean)
    .some((value) => String(value) === String(currentContact?.idMiembros ?? currentContact?.id));

export function ChatView() {
  const router = useRouter();

  const { user } = useAuthContext();

  const { contacts, contactsError, contactsLoading } = useGetContacts(Boolean(user?.accessToken));
  const currentContact = useChatCurrentContact(contacts);

  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get('id') || '';
  const sharedMessageParam = searchParams.get('share') || '';

  const { conversations, conversationsLoading } = useGetConversations(currentContact.idMiembros);
  const { conversation, conversationError, conversationLoading } = useGetConversation(
    selectedConversationId,
    currentContact.idMiembros
  );

  const roomNav = useCollapseNav();
  const conversationsNav = useCollapseNav();

  const [recipients, setRecipients] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [replyMessage, setReplyMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [sharedMessage, setSharedMessage] = useState('');
  const [typingIds, setTypingIds] = useState([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const handleTypingSnapshot = useCallback((ids) => {
    setTypingIds(ids);
  }, []);

  useChatRealtimeSync({
    idMiembros: currentContact.idMiembros,
    conversationId: selectedConversationId,
    onTypingSnapshot: handleTypingSnapshot,
  });

  useEffect(() => {
    setHasMoreMessages(true);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId && !sharedMessageParam) {
      startTransition(() => {
        router.push(paths.dashboard.chat);
      });
    }
  }, [conversationError, router, selectedConversationId, sharedMessageParam]);

  useEffect(() => {
    if (sharedMessageParam) {
      setSharedMessage(sharedMessageParam);
    }
  }, [sharedMessageParam]);

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

  const handleChangeGroupName = useCallback((value) => {
    setGroupName(value);
  }, []);

  const handleAddParticipants = useCallback(
    async (newParticipants) => {
      if (!selectedConversationId) return;

      await addParticipants(
        selectedConversationId,
        currentContact.idMiembros,
        newParticipants
      );
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleRemoveParticipant = useCallback(
    async (targetIdMiembros) => {
      if (!selectedConversationId) return;

      await removeParticipant(selectedConversationId, currentContact.idMiembros, targetIdMiembros);
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedConversationId || loadingOlder || !hasMoreMessages) return;

    const oldestMessage = conversation?.messages?.[0];
    if (!oldestMessage?.createdAt) return;

    setLoadingOlder(true);

    try {
      const { hasMore } = await loadOlderMessages(
        selectedConversationId,
        oldestMessage.createdAt,
        currentContact.idMiembros
      );
      setHasMoreMessages(hasMore);
    } catch (error) {
      console.error('[chat] no se pudo cargar historial anterior', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [
    conversation?.messages,
    currentContact.idMiembros,
    hasMoreMessages,
    loadingOlder,
    selectedConversationId,
  ]);

  const handleReplyMessage = useCallback((message) => {
    setReplyMessage(message);
  }, []);

  const handleClearReply = useCallback(() => {
    setReplyMessage(null);
  }, []);

  const handleEditMessage = useCallback((message) => {
    setReplyMessage(null);
    setEditingMessage(message);
  }, []);

  const handleClearEditing = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleConsumeSharedMessage = useCallback(() => {
    setSharedMessage('');
  }, []);

  const handleReactMessage = useCallback(
    async (message, reaction) => {
      if (!selectedConversationId) return;

      await reactMessage(selectedConversationId, message.id, currentContact.idMiembros, reaction);
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleDeleteMessage = useCallback(
    async (message) => {
      if (!selectedConversationId) return;

      await deleteMessage(selectedConversationId, message.id, currentContact.idMiembros);
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleRestoreMessage = useCallback(
    async (message) => {
      if (!selectedConversationId) return;

      await restoreMessage(selectedConversationId, message.id, currentContact.idMiembros);
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleToggleMuteConversation = useCallback(async () => {
    if (!selectedConversationId) return;

    await toggleMuteConversation(selectedConversationId, currentContact.idMiembros);
  }, [currentContact.idMiembros, selectedConversationId]);

  const handleReportConversation = useCallback(
    async (comment) => {
      if (!selectedConversationId) return;

      await reportConversation(selectedConversationId, currentContact.idMiembros, comment);
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleClearConversation = useCallback(async () => {
    if (!selectedConversationId) return;

    await clearConversation(selectedConversationId, currentContact.idMiembros);
  }, [currentContact.idMiembros, selectedConversationId]);

  const filteredParticipants = conversation
    ? conversation.participants.filter((participant) => !isSameMember(participant, currentContact))
    : [];

  const typingParticipantNames = typingIds
    .map((id) =>
      filteredParticipants.find(
        (participant) => String(participant.idMiembros ?? participant.id) === String(id)
      )?.name
    )
    .filter(Boolean);

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
              conversation={conversation}
              participants={filteredParticipants}
              loading={conversationLoading}
              onToggleMute={handleToggleMuteConversation}
              onReport={handleReportConversation}
              onClear={handleClearConversation}
            />
          ) : (
            <ChatHeaderCompose
              contacts={contacts}
              onAddRecipients={handleAddRecipients}
              groupName={groupName}
              onChangeGroupName={handleChangeGroupName}
            />
          ),
          nav: (
            <ChatNav
              contacts={contacts}
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              collapseNav={conversationsNav}
              loading={contactsLoading || conversationsLoading}
              error={contactsError}
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
                    onReply={handleReplyMessage}
                    onReact={handleReactMessage}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onRestore={handleRestoreMessage}
                    onLoadOlder={handleLoadOlderMessages}
                    loadingOlder={loadingOlder}
                    hasMoreMessages={hasMoreMessages}
                    typingParticipantNames={typingParticipantNames}
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
                groupName={groupName}
                participants={conversation?.participants ?? recipients}
                currentContact={currentContact}
                onAddRecipients={handleAddRecipients}
                replyMessage={replyMessage}
                editingMessage={editingMessage}
                onClearReply={handleClearReply}
                onClearEditing={handleClearEditing}
                selectedConversationId={selectedConversationId}
                sharedMessage={sharedMessage}
                onConsumeSharedMessage={handleConsumeSharedMessage}
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
              contacts={contacts}
              currentContact={currentContact}
              creatorIdMiembros={conversation?.creatorIdMiembros}
              onAddParticipants={handleAddParticipants}
              onRemoveParticipant={handleRemoveParticipant}
            />
          ),
        }}
      />
    </DashboardContent>
  );
}
