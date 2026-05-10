import { useRef, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------

export function useMessagesScroll(messages) {
  const messagesScrollRef = useRef(null);
  const hasScrolledInitiallyRef = useRef(false);
  const shouldStickToTopRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousFirstMessageIdRef = useRef('');

  const messageCount = messages?.length || 0;
  const firstMessageId = messages?.[0]?.id || '';

  const scrollToTop = useCallback(() => {
    if (!messagesScrollRef.current) {
      return;
    }

    messagesScrollRef.current.scrollTop = 0;
  }, []);

  useEffect(() => {
    const scrollElement = messagesScrollRef.current;

    if (!scrollElement) {
      return undefined;
    }

    const handleScroll = () => {
      shouldStickToTopRef.current = scrollElement.scrollTop < 80;
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
        firstMessageId &&
        previousFirstMessageIdRef.current &&
        firstMessageId !== previousFirstMessageIdRef.current);

    if (isFirstLoad || (hasNewMessage && shouldStickToTopRef.current)) {
      scrollToTop();
      hasScrolledInitiallyRef.current = true;
    }

    previousMessageCountRef.current = messageCount;
    previousFirstMessageIdRef.current = firstMessageId;
  }, [firstMessageId, messageCount, scrollToTop]);

  return { messagesScrollRef };
}
