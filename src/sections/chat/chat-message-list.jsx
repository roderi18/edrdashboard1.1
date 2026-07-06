import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';

import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';
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
  onLoadOlder,
  loadingOlder = false,
  hasMoreMessages = false,
  typingParticipantNames = [],
}) {
  const highlightTimeoutRef = useRef(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const sentinelRef = useRef(null);
  const scrollHeightBeforeLoadRef = useRef(null);
  const firstMessageIdRef = useRef('');

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

  // Preserva la posición de scroll cuando se anteponen mensajes antiguos (paginación).
  useLayoutEffect(() => {
    const newFirstId = String(sortedMessages[0]?.id ?? '');
    const scrollElement = messagesScrollRef.current;

    if (
      scrollElement &&
      firstMessageIdRef.current &&
      newFirstId &&
      newFirstId !== firstMessageIdRef.current &&
      scrollHeightBeforeLoadRef.current != null
    ) {
      scrollElement.scrollTop += scrollElement.scrollHeight - scrollHeightBeforeLoadRef.current;
      scrollHeightBeforeLoadRef.current = null;
    }

    firstMessageIdRef.current = newFirstId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedMessages.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollElement = messagesScrollRef.current;

    if (!sentinel || !scrollElement || !onLoadOlder) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreMessages && !loadingOlder) {
          scrollHeightBeforeLoadRef.current = scrollElement.scrollHeight;
          onLoadOlder();
        }
      },
      { root: scrollElement, threshold: 0 }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreMessages, loadingOlder, onLoadOlder, sortedMessages.length]);

  const searchMatches = searchQuery
    ? sortedMessages.filter(
        (message) =>
          !message.eliminado &&
          String(message.body || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  useEffect(() => {
    setMatchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (searchMatches.length) {
      handleJumpToMessage(searchMatches[matchIndex]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIndex, searchQuery]);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((value) => !value);
    setSearchQuery('');
  }, []);

  const handleNavigateMatch = useCallback(
    (direction) => {
      if (!searchMatches.length) return;

      setMatchIndex((current) => (current + direction + searchMatches.length) % searchMatches.length);
    },
    [searchMatches.length]
  );

  if (loading) {
    return <ChatMessageListSkeleton />;
  }

  return (
    <>
      <Box
        sx={{
          px: 3,
          py: 0.5,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <IconButton size="small" onClick={handleToggleSearch}>
          <Iconify icon="eva:search-fill" width={18} />
        </IconButton>
      </Box>

      {searchOpen && (
        <Box
          sx={{
            px: 3,
            pb: 1,
            gap: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <InputBase
            autoFocus
            fullWidth
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar en la conversación..."
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'background.neutral',
              typography: 'body2',
            }}
          />

          <Typography variant="caption" sx={{ color: 'text.disabled', whiteSpace: 'nowrap' }}>
            {searchMatches.length ? `${matchIndex + 1}/${searchMatches.length}` : '0/0'}
          </Typography>

          <IconButton size="small" disabled={!searchMatches.length} onClick={() => handleNavigateMatch(-1)}>
            <Iconify icon="eva:arrow-ios-upward-fill" width={16} />
          </IconButton>

          <IconButton size="small" disabled={!searchMatches.length} onClick={() => handleNavigateMatch(1)}>
            <Iconify icon="eva:arrow-ios-downward-fill" width={16} />
          </IconButton>
        </Box>
      )}

      <Scrollbar
        ref={messagesScrollRef}
        sx={{
          px: 3,
          pt: 1,
          pb: 3,
          flex: '1 1 auto',
        }}
      >
        <div ref={sentinelRef} />

        {loadingOlder && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        )}

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

        {!!typingParticipantNames.length && (
          <Typography
            variant="caption"
            sx={{ display: 'block', color: 'text.disabled', fontStyle: 'italic', mt: -2, mb: 3 }}
          >
            {typingParticipantNames.length === 1
              ? `${typingParticipantNames[0]} está escribiendo…`
              : `${typingParticipantNames.join(', ')} están escribiendo…`}
          </Typography>
        )}
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
