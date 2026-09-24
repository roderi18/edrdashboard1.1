'use client';

import { useMemo, useState, useEffect, useCallback, startTransition } from 'react';

import { useRouter, useSearchParams } from 'src/routes/hooks';

import { esConversacionDeSistema } from 'src/utils/chat-sistema.mjs';
import {
  buzonPorClave,
  contactoDeBuzon,
  idConversacionConBuzon,
} from 'src/utils/chat-buzones.mjs';

import { CONFIG } from 'src/global-config';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  leaveGroup,
  reactMessage,
  deleteMessage,
  restoreMessage,
  useGetContacts,
  addParticipants,
  clickConversation,
  loadOlderMessages,
  clearConversation,
  removeParticipant,
  createConversation,
  updateGroupDetails,
  reportConversation,
  useGetConversation,
  useGetConversations,
  setGroupAdministrator,
  toggleMuteConversation,
  transferGroupOwnership,
  clearConversationGlobally,
} from 'src/actions/chat';

import { EmptyContent } from 'src/components/empty-content';

import { useAuthContext } from 'src/auth/hooks';

import { ChatNav } from '../chat-nav';
import { ChatLayout } from '../layout';
import { ChatRoom } from '../chat-room';
import { rutaDelChat } from '../utils/ruta-del-chat';
import { ChatMessageList } from '../chat-message-list';
import { ChatMessageInput } from '../chat-message-input';
import { ChatHeaderDetails } from '../chat-header-details';
import { ChatHeaderCompose } from '../chat-header-compose';
import { useCollapseNav } from '../hooks/use-collapse-nav';
import { initialConversation } from '../utils/initial-conversation';
import { useChatRealtimeSync } from '../hooks/use-chat-realtime-sync';
import { useChatCurrentContact } from '../hooks/use-chat-current-contact';
import { resolverConversacionVisible } from '../utils/conversacion-recien-creada.mjs';
import { useBuzonesDelChat, useAvataresDeBuzones } from '../hooks/use-buzones-del-chat';
import { conAvataresDeBuzones, identidadDeBuzonEnElChat } from '../utils/buzones-del-chat';

// ----------------------------------------------------------------------

const isSameMember = (participant, currentContact) =>
  [participant?.idMiembros, participant?.id]
    .filter(Boolean)
    .some((value) => String(value) === String(currentContact?.idMiembros ?? currentContact?.id));

export function ChatView() {
  const router = useRouter();

  const { user } = useAuthContext();
  // LOS BUZONES QUE ATIENDE ESTA SESION (Tienda Virtual, Oficina Nacional) y en
  // cual esta ahora. Todo sale de los permisos: ver `useBuzonesDelChat`.
  const { buzones, buzonActual, bandeja, puedeAtender } = useBuzonesDelChat();
  // La foto de cada buzon en vivo: quien la cambia la ve al momento, sin esperar
  // a que el servidor renueve su copia.
  const avataresDeBuzones = useAvataresDeBuzones();

  const {
    contacts: contactosDelServidor,
    contactsError,
    contactsLoading,
  } = useGetContacts(Boolean(user?.accessToken), buzonActual?.idMiembros ?? null);
  const contacts = useMemo(
    () => conAvataresDeBuzones(contactosDelServidor, avataresDeBuzones),
    [contactosDelServidor, avataresDeBuzones]
  );
  const contactoPropio = useChatCurrentContact(contacts);
  // Quien soy AHORA: en una bandeja, su buzon. Todo lo de abajo lo usa sin saber
  // de bandejas: con que id pide, que mensajes son suyos y a nombre de quien
  // escribe.
  const currentContact = useMemo(
    () =>
      identidadDeBuzonEnElChat(
        contactoPropio,
        buzonActual,
        buzonActual ? avataresDeBuzones.get(buzonActual.clave) : ''
      ),
    [contactoPropio, buzonActual, avataresDeBuzones]
  );
  // En su bandeja el buzon no se busca a si mismo.
  const visibleContacts = useMemo(
    () =>
      buzonActual
        ? contacts.filter(
          (contact) => Number(contact.idMiembros ?? contact.id) !== buzonActual.idMiembros
        )
        : contacts,
    [contacts, buzonActual]
  );

  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get('id') || '';
  const sharedMessageParam = searchParams.get('share') || '';
  // "Escribir a la Tienda" llega con `?con=tienda`; a la Oficina, con `?con=oficina`.
  const buzonParaEscribir = buzonPorClave(searchParams.get('con'));

  const {
    conversations,
    conversationsLoading,
    conversationsHasMore,
    conversationsLoadingMore,
    loadMoreConversations,
  } = useGetConversations(currentContact.idMiembros);
  const {
    conversation: conversationFromServer,
    conversationError,
    conversationLoading: conversationLoadingFromServer,
  } = useGetConversation(
    selectedConversationId,
    currentContact.idMiembros
  );
  const [recentlyCreatedConversation, setRecentlyCreatedConversation] = useState(null);
  const { conversacion: conversation, cargando: conversationLoading } =
    resolverConversacionVisible({
      conversacionDelServidor: conversationFromServer,
      conversacionRecienCreada: recentlyCreatedConversation,
      idConversacionSeleccionada: selectedConversationId,
      cargando: conversationLoadingFromServer,
    });
  // La lista de la izquierda tambien: cada conversacion con un buzon, con su foto actual.
  const conversacionesConFoto = useMemo(
    () =>
      avataresDeBuzones.size
        ? {
          ...conversations,
          byId: Object.fromEntries(
            Object.entries(conversations.byId).map(([id, item]) => [
              id,
              { ...item, participants: conAvataresDeBuzones(item.participants, avataresDeBuzones) },
            ])
          ),
        }
        : conversations,
    [conversations, avataresDeBuzones]
  );
  const participantesConFoto = useMemo(
    () => conAvataresDeBuzones(conversation?.participants ?? [], avataresDeBuzones),
    [conversation?.participants, avataresDeBuzones]
  );
  // EL CHAT DE SISTEMA SOLO SE LEE: sin caja de escribir y sin "Responder". El
  // servidor y las reglas tambien rechazan el envio; esto solo evita ofrecerlo.
  const esChatDeSistema =
    esConversacionDeSistema({ id: selectedConversationId }) ||
    (Boolean(selectedConversationId) &&
      esConversacionDeSistema({ participants: conversation?.participants }));

  const roomNav = useCollapseNav();
  const conversationsNav = useCollapseNav();

  const [recipients, setRecipients] = useState([]);

  // ABRIR UN CHAT NUEVO NO ESPERA A NADIE.
  //
  // Al pulsar a una persona en el buscador, antes se creaba la conversacion en
  // el servidor y solo entonces se entraba: un viaje de ida y vuelta mirando la
  // lista. Ahora se entra al momento con esa persona ya puesta de destinatario,
  // y la conversacion se crea sola al enviar el primer mensaje —que es cuando
  // hay algo que guardar—.
  //
  // El contacto llega EN MANO desde la lista, no por la barra de direcciones:
  // pasarlo por el URL obligaba a buscarlo despues entre los contactos, y si esa
  // busqueda no casaba se quedaba todo en blanco sin decir por que.
  const abrirChatCon = useCallback(
    (contacto) => {
      if (!contacto) return;

      setRecipients([contacto]);

      // Solo se navega si hace falta. Si ya hay un `?id=` abierto hay que
      // quitarlo —si no, seguiria viendose la conversacion anterior—, pero si no
      // lo hay, navegar a la misma direccion volvia a montar la pantalla entera
      // y las caras de la lista parpadeaban por nada.
      if (selectedConversationId) router.replace(rutaDelChat({ bandeja }));
    },
    [bandeja, router, selectedConversationId]
  );

  const handleCambiarBandeja = useCallback(
    (clave) => {
      setRecipients([]);
      startTransition(() => {
        router.push(rutaDelChat({ bandeja: clave }));
      });
    },
    [router]
  );
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
    enabled: Boolean(user?.accessToken),
    idMiembros: currentContact.idMiembros,
    conversationId: selectedConversationId,
    visibilityCutoff: conversation?.visibleAfter,
    onTypingSnapshot: handleTypingSnapshot,
  });

  useEffect(() => {
    setHasMoreMessages(true);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId && !sharedMessageParam && !buzonParaEscribir) {
      startTransition(() => {
        router.push(rutaDelChat({ bandeja }));
      });
    }
  }, [
    buzonParaEscribir,
    conversationError,
    bandeja,
    router,
    selectedConversationId,
    sharedMessageParam,
  ]);

  // "ESCRIBIR A LA TIENDA" DESDE LA TIENDA —y lo mismo a la Oficina—. Llega con
  // `?con=<buzon>`. Si ya hay conversacion con el se abre, con su historia; si no,
  // se entra al chat nuevo con el buzon puesto y la conversacion se crea con el
  // primer mensaje.
  useEffect(() => {
    if (!buzonParaEscribir || buzonActual || conversationsLoading) return;

    const idExistente = currentContact.idMiembros
      ? idConversacionConBuzon(buzonParaEscribir, currentContact.idMiembros)
      : '';

    if (idExistente && conversations.byId[idExistente]) {
      router.replace(rutaDelChat({ id: idExistente }));
      return;
    }

    setRecipients([
      contactoDeBuzon(buzonParaEscribir, avataresDeBuzones.get(buzonParaEscribir.clave)),
    ]);
    router.replace(rutaDelChat());
  }, [
    avataresDeBuzones,
    buzonActual,
    buzonParaEscribir,
    conversations.byId,
    conversationsLoading,
    currentContact.idMiembros,
    router,
  ]);

  useEffect(() => {
    if (sharedMessageParam) {
      setSharedMessage(sharedMessageParam);
    }
  }, [sharedMessageParam]);

  useEffect(() => {
    if (!selectedConversationId || !currentContact.idMiembros || !conversation?.unreadCount) {
      return undefined;
    }

    let marking = false;
    const markVisibleConversationAsRead = () => {
      if (marking || document.visibilityState !== 'visible' || !document.hasFocus()) return;

      marking = true;
      clickConversation(selectedConversationId, currentContact.idMiembros)
        .catch((error) => {
          console.error('[chat] no se pudo marcar la conversación como leída', error);
        })
        .finally(() => {
          marking = false;
        });
    };

    markVisibleConversationAsRead();
    window.addEventListener('focus', markVisibleConversationAsRead);
    document.addEventListener('visibilitychange', markVisibleConversationAsRead);

    return () => {
      window.removeEventListener('focus', markVisibleConversationAsRead);
      document.removeEventListener('visibilitychange', markVisibleConversationAsRead);
    };
  }, [conversation?.unreadCount, currentContact.idMiembros, selectedConversationId]);

  const handleAddRecipients = useCallback((selected) => {
    setRecipients(selected);
  }, []);

  const handleConversationCreated = useCallback((createdConversation) => {
    setRecentlyCreatedConversation(createdConversation ?? null);
  }, []);

  // Conserva el destinatario durante la navegación del primer mensaje. Si se
  // vacía antes de que `?id=` llegue a la vista, durante un render no existe ni
  // destinatario ni conversación seleccionada y el centro pestañea en blanco.
  useEffect(() => {
    if (selectedConversationId) setRecipients([]);
  }, [selectedConversationId]);

  useEffect(() => {
    if (
      conversationFromServer?.id &&
      String(conversationFromServer.id) === String(recentlyCreatedConversation?.id)
    ) {
      setRecentlyCreatedConversation(null);
    }
  }, [conversationFromServer, recentlyCreatedConversation?.id]);

  const handleChangeGroupName = useCallback((value) => {
    setGroupName(value);
  }, []);

  const handleAddParticipants = useCallback(
    async (newParticipants, historyVisibility = 'none') => {
      if (!selectedConversationId || !newParticipants?.length) return;

      // UN CHAT DE DOS NO SE CONVIERTE EN GRUPO: SE ABRE UNO NUEVO.
      //
      // El panel de la derecha ofrece "Agregar miembro" en cuanto hay dos
      // personas, y en un chat de dos siempre las hay, asi que pulsarlo llamaba a
      // "agregar participantes" y el servidor contestaba "esta operación solo
      // está disponible en conversaciones grupales". Un mensaje de error donde
      // deberia haber un grupo.
      //
      // Y la conversacion NO se convierte en grupo: lo que se escribieron los dos
      // es de los dos, y quien entra no tiene por que leerlo. Se crea un grupo
      // aparte con todos —los que ya estaban y los nuevos—, y el chat privado se
      // queda donde estaba.
      if (conversation && conversation.type !== 'GROUP') {
        const acompanantes = participantesConFoto.filter(
          (participant) => !isSameMember(participant, currentContact)
        );
        const { conversationData } = initialConversation({
          recipients: [...acompanantes, ...newParticipants],
          me: currentContact,
        });
        // Nace vacio: el grupo es el sitio, y lo primero que se diga ahi lo dice
        // quien quiera, no un mensaje automatico.
        const creada = await createConversation(
          { ...conversationData, messages: [] },
          currentContact.idMiembros
        );

        if (creada?.conversation?.id) {
          router.push(rutaDelChat({ id: creada.conversation.id, bandeja }));
        }

        return;
      }

      await addParticipants(
        selectedConversationId,
        currentContact.idMiembros,
        newParticipants,
        historyVisibility
      );
    },
    [
      bandeja,
      conversation,
      currentContact,
      participantesConFoto,
      router,
      selectedConversationId,
    ]
  );

  const handleRemoveParticipant = useCallback(
    async (targetIdMiembros) => {
      if (!selectedConversationId) return;

      await removeParticipant(selectedConversationId, currentContact.idMiembros, targetIdMiembros);
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleLeaveGroup = useCallback(async () => {
    if (!selectedConversationId) return;

    await leaveGroup(selectedConversationId, currentContact.idMiembros);
    startTransition(() => router.push(rutaDelChat({ bandeja })));
  }, [currentContact.idMiembros, bandeja, router, selectedConversationId]);

  const handleSetGroupAdministrator = useCallback(
    async (administratorIdMiembros, makeAdmin) => {
      if (!selectedConversationId) return;

      await setGroupAdministrator(
        selectedConversationId,
        currentContact.idMiembros,
        administratorIdMiembros,
        makeAdmin
      );
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleTransferGroupOwnership = useCallback(
    async (targetIdMiembros) => {
      if (!selectedConversationId) return;

      await transferGroupOwnership(
        selectedConversationId,
        currentContact.idMiembros,
        targetIdMiembros
      );
    },
    [currentContact.idMiembros, selectedConversationId]
  );

  const handleUpdateGroup = useCallback(
    async (name, avatarUrl) => {
      if (!selectedConversationId) return;

      await updateGroupDetails(
        selectedConversationId,
        currentContact.idMiembros,
        name,
        avatarUrl
      );
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

  const handleClearConversationGlobally = useCallback(async () => {
    if (!selectedConversationId) return;

    await clearConversationGlobally(selectedConversationId, currentContact.idMiembros);
  }, [currentContact.idMiembros, selectedConversationId]);

  const filteredParticipants = conversation
    ? participantesConFoto.filter((participant) => !isSameMember(participant, currentContact))
    : [];

  const typingParticipantNames = typingIds
    .map((id) =>
      filteredParticipants.find(
        (participant) => String(participant.idMiembros ?? participant.id) === String(id)
      )?.name
    )
    .filter(Boolean);

  return (
    // SIN CABECERA: TODA LA PANTALLA ES LA CONVERSACION.
    //
    // Habia un titulo "Mensajes" y una fila de pestañas de bandeja. El titulo
    // repetia lo que ya dice el menu de donde se entro, y las pestañas se mudaron
    // a la lista, en circulos junto a la foto (`ChatBandejasAvatares`). Entre las
    // dos se llevaban unos 80px de alto en una pantalla que lo que quiere enseñar
    // son los mensajes.
    <DashboardContent
      maxWidth={false}
      sx={[
        { display: 'flex', flex: '1 1 auto', flexDirection: 'column' },
        // LA PANTALLA ES PARA LA CONVERSACION.
        //
        // En el celular la barra flotante no sale en el chat (ver el layout del
        // panel), asi que el panel vuelve a llegar hasta abajo: solo el mismo
        // aire que arriba mas el area segura del telefono (la raya de inicio del
        // iPhone). Antes dejaba 96px libres para la barra y eso eran mensajes
        // menos en una pantalla que es para la conversacion.
        (theme) => ({
          '--layout-dashboard-content-pt': theme.spacing(3.5),
          '--layout-dashboard-content-pb': `calc(${theme.spacing(3.5)} + env(safe-area-inset-bottom))`,
          [theme.breakpoints.up('lg')]: {
            '--layout-dashboard-content-pb': theme.spacing(3.5),
          },
        }),
      ]}
    >
      <ChatLayout
        slots={{
          // UN CHAT NUEVO SE VE COMO UN CHAT, NO COMO UN FORMULARIO.
          //
          // Al elegir a alguien en el buscador, su nombre caia en el campo
          // "Para:" y habia que mirarlo ahi arriba, entre etiquetas, como si
          // faltara algo por rellenar. Ahora se abre con su cara y su nombre en
          // la cabecera, igual que una conversacion de siempre: lo unico que la
          // distingue es que todavia no tiene mensajes.
          //
          // El campo "Para:" sigue ahi para lo que sirve de verdad: empezar un
          // grupo con varias personas cuando aun no se ha elegido a ninguna.
          header: selectedConversationId || recipients.length === 1 ? (
            <ChatHeaderDetails
              collapseNav={roomNav}
              conversation={selectedConversationId ? conversation : null}
              participants={selectedConversationId ? filteredParticipants : recipients}
              loading={conversationLoading}
              onToggleMute={handleToggleMuteConversation}
              onReport={handleReportConversation}
              onClear={handleClearConversation}
              onClearGlobal={handleClearConversationGlobally}
              onUpdateGroup={handleUpdateGroup}
            />
          ) : (
            <ChatHeaderCompose
              contacts={visibleContacts}
              recipients={recipients}
              onAddRecipients={handleAddRecipients}
              groupName={groupName}
              onChangeGroupName={handleChangeGroupName}
            />
          ),
          nav: (
            <ChatNav
              onStartChat={abrirChatCon}
              contacts={visibleContacts}
              currentContact={currentContact}
              bandeja={bandeja}
              buzones={buzones}
              buzonActual={buzonActual}
              onCambiarBandeja={handleCambiarBandeja}
              conversations={conversacionesConFoto}
              selectedConversationId={selectedConversationId}
              collapseNav={conversationsNav}
              loading={contactsLoading || conversationsLoading}
              error={contactsError}
              hasMore={conversationsHasMore}
              loadingMore={conversationsLoadingMore}
              onLoadMore={loadMoreConversations}
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
                    participants={participantesConFoto}
                    currentContact={currentContact}
                    loading={conversationLoading}
                    onReply={esChatDeSistema ? undefined : handleReplyMessage}
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
              ) : recipients.length ? (
                // CHAT NUEVO, TODAVIA SIN CONVERSACION.
                //
                // Aqui solo se miraba si habia conversacion seleccionada, asi que
                // al abrirle el chat a alguien nuevo el nombre salia arriba en
                // "Para:" pero el centro seguia diciendo "Selecciona una
                // conversacion". Parecia que pulsar a la persona no hacia nada.
                //
                // Se enseña el hilo vacio, listo para escribir. La conversacion
                // se crea con el primer mensaje.
                <ChatMessageList
                  messages={recentlyCreatedConversation?.messages ?? []}
                  participants={recipients}
                  currentContact={currentContact}
                  loading={false}
                  hasMoreMessages={false}
                />
              ) : (
                <EmptyContent
                  title="Selecciona una conversación"
                  description="Busca un contacto o escribe un mensaje nuevo."
                  imgUrl={`${CONFIG.assetsDir}/assets/icons/empty/ic-chat-active.svg`}
                />
              )}

              <ChatMessageInput
                authReady={Boolean(user?.accessToken)}
                recipients={recipients}
                groupName={groupName}
                participants={conversation ? participantesConFoto : recipients}
                currentContact={currentContact}
                replyMessage={replyMessage}
                editingMessage={editingMessage}
                onClearReply={handleClearReply}
                onClearEditing={handleClearEditing}
                selectedConversationId={selectedConversationId}
                onConversationCreated={handleConversationCreated}
                // Silenciar la conversacion tambien calla sus sonidos.
                silenciada={Boolean(conversation?.muted)}
                // A nombre de quien sale lo que se escribe. Solo se dice a quien
                // tiene dos bandejas: para el resto no hay duda posible.
                respondiendoComo={
                  puedeAtender ? (buzonActual ? buzonActual.nombre : contactoPropio.name) : ''
                }
                sharedMessage={sharedMessage}
                onConsumeSharedMessage={handleConsumeSharedMessage}
                disabled={!user?.accessToken || (!recipients.length && !selectedConversationId)}
              />
            </>
          ),
          details: conversation && selectedConversationId && (
            <ChatRoom
              collapseNav={roomNav}
              esGrupo={conversation?.type === 'GROUP'}
              participants={participantesConFoto}
              loading={conversationLoading}
              messages={conversation?.messages ?? []}
              contacts={visibleContacts}
              currentContact={currentContact}
              creatorIdMiembros={conversation?.creatorIdMiembros}
              administratorIds={conversation?.administratorIds ?? []}
              onAddParticipants={handleAddParticipants}
              onRemoveParticipant={handleRemoveParticipant}
              onLeaveGroup={handleLeaveGroup}
              onSetGroupAdministrator={handleSetGroupAdministrator}
              onTransferGroupOwnership={handleTransferGroupOwnership}
            />
          ),
        }}
      />
    </DashboardContent>
  );
}
