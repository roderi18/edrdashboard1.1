'use client';

import { SelectorDeEmojis } from 'src/components/emoji/selector-de-emojis';

// ----------------------------------------------------------------------
// El selector de emojis del muro.
//
// Tenia su propia rejilla, copiada de la del chat: dos sitios que enseñaban lo
// mismo y habia que arreglar dos veces. Ahora los dos usan el mismo, con
// buscador y con los nombres en español.
//
// Se conservan `emojiCategory` y `onChangeCategory` porque las pantallas que lo
// usan siguen pasandolos; ya no hacen falta —la categoria la lleva el propio
// selector— y se ignoran sin romper nada.
// ----------------------------------------------------------------------

export function ProfileEmojiPicker({ open, anchorEl, onClose, onSelectEmoji }) {
  return (
    <SelectorDeEmojis
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      onSelectEmoji={onSelectEmoji}
    />
  );
}
