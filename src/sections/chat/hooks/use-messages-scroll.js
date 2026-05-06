import { useRef, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------

export function useMessagesScroll(messages) {
  const messagesEndRef = useRef(null);
  const hasScrolledInitiallyRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousLastMessageIdRef = useRef('');

  const messageCount = messages?.length || 0;
  const lastMessageId = messages?.[messageCount - 1]?.id || '';

  const scrollToBottom = useCallback(() => {
    if (!messagesEndRef.current) {
      return;
    }

    messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    const scrollElement = messagesEndRef.current;

    if (!scrollElement) {
      return undefined;
    }

    const handleScroll = () => {
      const distanceFromBottom =
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;

      shouldStickToBottomRef.current = distanceFromBottom < 80;
    };

    handleScroll();
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const isFirstLoad = !hasScrolledInitiallyRef.current;
    const hasNewMessage =
      messageCount > previousMessageCountRef.current ||
      (messageCount === previousMessageCountRef.current &&
        lastMessageId &&
        previousLastMessageIdRef.current &&
        lastMessageId !== previousLastMessageIdRef.current);

    if (isFirstLoad || (hasNewMessage && shouldStickToBottomRef.current)) {
      scrollToBottom();
      hasScrolledInitiallyRef.current = true;
    }

    previousMessageCountRef.current = messageCount;
    previousLastMessageIdRef.current = lastMessageId;
  }, [lastMessageId, messageCount, scrollToBottom]);

  return { messagesEndRef };
}
