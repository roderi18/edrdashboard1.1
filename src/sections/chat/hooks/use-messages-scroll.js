import { useRef, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------
// LA LISTA DE MENSAJES, PEGADA AL FONDO.
//
// Una foto se coloca antes de terminar de cargarse: la lista bajaba al fondo con
// la foto aún sin alto, la imagen crecía cientos de píxeles después y quedaba
// cortada abajo. A partir de ahí la lista ya no se daba por "al fondo" y los
// mensajes nuevos no la movían: la foto se quedaba enganchada abajo. Tres
// arreglos:
//   1. Al cargar una imagen o un video, si se estaba al fondo, se vuelve al fondo.
//   2. Un mensaje PROPIO baja siempre la lista (acabas de escribirlo).
//   3. La escucha del scroll se engancha aunque la lista aparezca tarde (antes
//      se montaba con el esqueleto de carga y no llegaba a engancharse).
// ----------------------------------------------------------------------

const DISTANCIA_PARA_ESTAR_AL_FONDO = 120;

export function useMessagesScroll(messages, { idPropio = '' } = {}) {
  const messagesScrollRef = useRef(null);
  const hasScrolledInitiallyRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousLastMessageIdRef = useRef('');

  const messageCount = messages?.length || 0;
  const lastMessage = messages?.[messageCount - 1];
  const lastMessageId = lastMessage?.id || '';
  const ultimoEsPropio =
    Boolean(idPropio) && String(lastMessage?.senderId ?? '') === String(idPropio);

  const scrollToBottom = useCallback(() => {
    if (!messagesScrollRef.current) {
      return;
    }

    messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
  }, []);

  const scrollElement = messagesScrollRef.current;

  useEffect(() => {
    if (!scrollElement) {
      return undefined;
    }

    const handleScroll = () => {
      const distanceFromBottom =
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;

      shouldStickToBottomRef.current = distanceFromBottom < DISTANCIA_PARA_ESTAR_AL_FONDO;
    };

    // Una imagen o un video que termina de cargar cambia el alto: si se estaba
    // al fondo, se sigue al fondo. `load` no burbujea, así que se escucha en la
    // fase de captura.
    const handleMediaLoaded = () => {
      if (shouldStickToBottomRef.current) scrollToBottom();
    };

    handleScroll();
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    scrollElement.addEventListener('load', handleMediaLoaded, true);
    scrollElement.addEventListener('loadeddata', handleMediaLoaded, true);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('load', handleMediaLoaded, true);
      scrollElement.removeEventListener('loadeddata', handleMediaLoaded, true);
    };
  }, [scrollElement, scrollToBottom]);

  useEffect(() => {
    const isFirstLoad = !hasScrolledInitiallyRef.current;
    const hasNewMessage =
      messageCount > previousMessageCountRef.current ||
      (messageCount === previousMessageCountRef.current &&
        lastMessageId &&
        previousLastMessageIdRef.current &&
        lastMessageId !== previousLastMessageIdRef.current);

    if (isFirstLoad || (hasNewMessage && (shouldStickToBottomRef.current || ultimoEsPropio))) {
      scrollToBottom();
      shouldStickToBottomRef.current = true;
      hasScrolledInitiallyRef.current = true;
    }

    previousMessageCountRef.current = messageCount;
    previousLastMessageIdRef.current = lastMessageId;
  }, [lastMessageId, messageCount, scrollToBottom, ultimoEsPropio]);

  return { messagesScrollRef };
}
