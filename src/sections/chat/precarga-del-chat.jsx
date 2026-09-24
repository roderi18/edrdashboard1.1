'use client';

import { useGetContacts, useGetConversations } from 'src/actions/chat';

// ----------------------------------------------------------------------
// EL CHAT, LISTO ANTES DE ENTRAR.
//
// Qué se rompía: al pulsar "Chats", la lista de conversaciones tardaba 0,9-1,2 s
// y los contactos 0,8 s, porque se pedían en ese momento. Esto los pide en
// segundo plano mientras se está en cualquier otra pantalla —cuando el navegador
// ya quedó libre— y los deja en la caché de SWR con las mismas claves que usa la
// pantalla de chat: al entrar, salen al instante y se repasan por detrás.
//
// Se carga diferido (`next/dynamic`) desde el panel: así `src/actions/chat` no
// viaja con el arranque de cada pantalla. No pinta nada.
// ----------------------------------------------------------------------

export default function PrecargaDelChat({ idMiembros }) {
  useGetConversations(idMiembros, true, { precarga: true });
  useGetContacts(true);

  return null;
}
