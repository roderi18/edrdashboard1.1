import { useRef, useState, useCallback } from 'react';

import { Scrollbar } from 'src/components/scrollbar';
import { Lightbox, useLightbox } from 'src/components/lightbox';

import { ChatMessageItem } from './chat-message-item';
import { ChatMessageListSkeleton } from './chat-skeleton';
import { useMessagesScroll } from './hooks/use-messages-scroll';

// ----------------------------------------------------------------------

const getMessageTime = (message) => {
  const time = new Date(message?.createdAt ?? 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

export function ChatMessageList({
  messages = [],
  participants,
  currentContact,
  loading,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onRestore,
}) {
  const highlightTimeoutRef = useRef(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState('');

  const sortedMessages = [...messages].sort((firstMessage, secondMessage) => {
    const timeDifference = getMessageTime(firstMessage) - getMessageTime(secondMessage);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return String(firstMessage.id ?? '').localeCompare(String(secondMessage.id ?? ''));
  });

  const { messagesScrollRef } = useMessagesScroll(sortedMessages);

  const slides = sortedMessages.flatMap((message) => {
    if (message.contentType !== 'image') return [];

    const imageAttachments = (message.attachments || [])
      .map((attachment) => attachment.url || attachment.downloadURL || attachment.previewUrl)
      .filter(Boolean);

    return (imageAttachments.length ? imageAttachments : [message.body])
      .filter(Boolean)
      .map((src) => ({ src }));
  });

  const lightbox = useLightbox(slides);

  const handleJumpToMessage = useCallback((messageId) => {
    if (!messageId) return;

    const messageElement = document.getElementById(`chat-message-${messageId}`);

    if (!messageElement) return;

    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(String(messageId));

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId('');
    }, 1000);
  }, []);

  if (loading) {
    return <ChatMessageListSkeleton />;
  }

  return (
    <>
      <Scrollbar
        ref={messagesScrollRef}
        sx={{
          px: 3,
          pt: 5,
          pb: 3,
          flex: '1 1 auto',
        }}
      >
        {sortedMessages.map((message, index) => (
          <ChatMessageItem
            key={`${message.id || 'mensaje'}-${index}`}
            message={message}
            participants={participants}
            currentContact={currentContact}
            onOpenLightbox={lightbox.onOpen}
            onReply={onReply}
            onReact={onReact}
            onEdit={onEdit}
            onDelete={onDelete}
            onRestore={onRestore}
            onJumpToMessage={handleJumpToMessage}
            highlighted={String(highlightedMessageId) === String(message.id)}
          />
        ))}
      </Scrollbar>

      <Lightbox
        slides={slides}
        open={lightbox.open}
        close={lightbox.onClose}
        index={lightbox.selected}
      />
    </>
  );
}
