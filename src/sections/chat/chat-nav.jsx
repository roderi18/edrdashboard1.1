import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import InputAdornment from '@mui/material/InputAdornment';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { logChatClientError, getChatErrorMessage } from 'src/utils/chat-error.mjs';

import { createConversation } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { ToggleButton } from './styles';
import { ChatNavItem } from './chat-nav-item';
import { ChatNavAccount } from './chat-nav-account';
import { ChatNavItemSkeleton } from './chat-skeleton';
import { ChatNavSearchResults } from './chat-nav-search-results';
import { usePresenceStatuses } from './hooks/use-presence-status';
import { initialConversation } from './utils/initial-conversation';
import { useChatCurrentContact } from './hooks/use-chat-current-contact';
import {
  searchChatDirectory,
  getNextUnreadConversationId,
} from './utils/productivity.mjs';

// ----------------------------------------------------------------------

const NAV_WIDTH = 320;
const NAV_COLLAPSE_WIDTH = 96;

export function ChatNav({
  error: contactsError,
  loading,
  contacts,
  collapseNav,
  conversations,
  selectedConversationId,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const router = useRouter();
  const conversationsInFlightRef = useRef(new Set());
  const searchInputRef = useRef(null);

  const myContact = useChatCurrentContact(contacts);

  const mdUp = useMediaQuery((theme) => theme.breakpoints.up('md'));

  const {
    openMobile,
    onOpenMobile,
    onCloseMobile,
    onCloseDesktop,
    collapseDesktop,
    onCollapseDesktop,
  } = collapseNav;

  const [searchContacts, setSearchContacts] = useState({
    query: '',
    results: [],
    conversationResults: [],
  });
  const conversationParticipantIds = useMemo(
    () =>
      conversations.allIds.flatMap((conversationId) =>
        (conversations.byId[conversationId]?.participants ?? []).map(
          (participant) => participant.idMiembros ?? participant.id
        )
      ),
    [conversations.allIds, conversations.byId]
  );
  const presenceStatuses = usePresenceStatuses(conversationParticipantIds);

  useEffect(() => {
    if (!mdUp) {
      onCloseDesktop();
    }
  }, [onCloseDesktop, mdUp]);

  const handleToggleNav = useCallback(() => {
    if (mdUp) {
      onCollapseDesktop();
    } else {
      onCloseMobile();
    }
  }, [mdUp, onCloseMobile, onCollapseDesktop]);

  const handleClickCompose = useCallback(() => {
    if (!mdUp) {
      onCloseMobile();
    }
    router.push(paths.dashboard.chat);
  }, [mdUp, onCloseMobile, router]);

  const handleSearchContacts = useCallback(
    (inputValue) => {
      const searchResults = searchChatDirectory({
        query: inputValue,
        contacts,
        conversations,
        currentMemberId: myContact.idMiembros ?? myContact.id,
      });

      setSearchContacts({
        query: inputValue,
        results: searchResults.contacts,
        conversationResults: searchResults.conversations,
      });
    },
    [contacts, conversations, myContact.id, myContact.idMiembros]
  );

  const handleClickAwaySearch = useCallback(() => {
    setSearchContacts({ query: '', results: [], conversationResults: [] });
  }, []);

  const handleNavigateUnread = useCallback(() => {
    const conversationId = getNextUnreadConversationId({
      ...conversations,
      currentId: selectedConversationId,
    });

    if (conversationId) router.push(`${paths.dashboard.chat}?id=${conversationId}`);
  }, [conversations, router, selectedConversationId]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleNavigateUnread();
      } else if (event.key === 'Escape' && searchContacts.query) {
        handleClickAwaySearch();
      }
    };

    window.addEventListener('keydown', handleShortcut);

    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleClickAwaySearch, handleNavigateUnread, searchContacts.query]);

  const handleClickResult = useCallback(
    async (result) => {
      handleClickAwaySearch();

      const linkTo = (id) => router.push(`${paths.dashboard.chat}?id=${id}`);
      const resultId = String(result.id);

      if (conversationsInFlightRef.current.has(resultId)) return;

      try {
        // Reusar una conversación individual existente con este miembro.
        const existingConversation = Object.values(conversations.byId).find(
          (conversation) =>
            conversation.type === 'ONE_TO_ONE' &&
            conversation.participants.some((participant) => participant.id === result.id)
        );

        if (existingConversation) {
          linkTo(existingConversation.id);
          return;
        }

        conversationsInFlightRef.current.add(resultId);

        const recipient = contacts.find((contact) => contact.id === result.id);
        if (!recipient) {
          toast.error('No se pudo identificar el contacto seleccionado.');
          return;
        }

        const { conversationData } = initialConversation({
          recipients: [recipient],
          me: myContact,
        });

        const res = await createConversation(conversationData, myContact.idMiembros);

        if (!res || !res.conversation) {
          toast.error('No se recibió la conversación creada.');
          return;
        }

        // Navigate to the new conversation
        linkTo(res.conversation.id);
      } catch (error) {
        logChatClientError('create-conversation', error);
        toast.error(getChatErrorMessage(error, 'No se pudo iniciar la conversación.'));
      } finally {
        conversationsInFlightRef.current.delete(resultId);
      }
    },
    [contacts, conversations.byId, handleClickAwaySearch, myContact, router]
  );

  const renderLoading = () => <ChatNavItemSkeleton />;

  const renderList = () => (
    <nav>
      <Box component="ul">
        {conversations.allIds.map((conversationId) => (
          <ChatNavItem
            key={conversationId}
            collapse={collapseDesktop}
            currentContact={myContact}
            conversation={conversations.byId[conversationId]}
            presenceStatuses={presenceStatuses}
            selected={conversationId === selectedConversationId}
            onCloseMobile={onCloseMobile}
          />
        ))}
        {hasMore && (
          <Box component="li" sx={{ display: 'flex', justifyContent: 'center', p: 1.5 }}>
            <Button
              size="small"
              loading={loadingMore}
              aria-label="Cargar conversaciones anteriores"
              onClick={onLoadMore}
            >
              Ver conversaciones anteriores
            </Button>
          </Box>
        )}
      </Box>
    </nav>
  );

  const renderListResults = () => (
    <ChatNavSearchResults
      query={searchContacts.query}
      results={searchContacts.results}
      conversationResults={searchContacts.conversationResults}
      currentMemberId={myContact.idMiembros ?? myContact.id}
      onClickResult={handleClickResult}
      onClickConversationResult={(conversation) => {
        handleClickAwaySearch();
        router.push(`${paths.dashboard.chat}?id=${conversation.id}`);
      }}
    />
  );

  const renderSearchInput = () => (
    <ClickAwayListener onClickAway={handleClickAwaySearch}>
      <TextField
        inputRef={searchInputRef}
        fullWidth
        value={searchContacts.query}
        onChange={(event) => handleSearchContacts(event.target.value)}
        placeholder="Buscar contactos..."
        aria-label="Buscar contactos, conversaciones y mensajes recientes"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mt: 2.5 }}
      />
    </ClickAwayListener>
  );

  const renderContent = () => (
    <>
      <Box
        sx={{
          pt: 2.5,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!collapseDesktop && (
          <>
            <ChatNavAccount currentContact={myContact} />
            <Box sx={{ flexGrow: 1 }} />
          </>
        )}

        <IconButton onClick={handleToggleNav}>
          <Iconify
            icon={collapseDesktop ? 'eva:arrow-ios-forward-fill' : 'eva:arrow-ios-back-fill'}
          />
        </IconButton>

        {!collapseDesktop && (
          <>
            <Tooltip title="Siguiente conversación no leída (Alt+Mayús+N)">
              <span>
                <IconButton
                  aria-label="Ir a la siguiente conversación no leída"
                  disabled={!conversations.allIds.some(
                    (id) => Number(conversations.byId[id]?.unreadCount) > 0
                  )}
                  onClick={handleNavigateUnread}
                >
                  <Iconify width={22} icon="solar:chat-unread-bold" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton aria-label="Crear conversación" onClick={handleClickCompose}>
              <Iconify width={24} icon="solar:user-plus-bold" />
            </IconButton>
          </>
        )}
      </Box>

      <Box sx={{ p: 2.5, pt: 0 }}>{!collapseDesktop && renderSearchInput()}</Box>

      {contactsError && !collapseDesktop ? (
        <Alert severity="error" sx={{ mx: 2.5 }}>
          {contactsError.message || 'No se pudieron cargar los contactos.'}
        </Alert>
      ) : loading ? (
        renderLoading()
      ) : (
        <Scrollbar sx={{ pb: 1 }}>
          {searchContacts.query
            ? renderListResults()
            : renderList()}
        </Scrollbar>
      )}
    </>
  );

  return (
    <>
      <ToggleButton onClick={onOpenMobile} sx={{ display: { md: 'none' } }}>
        <Iconify width={16} icon="solar:users-group-rounded-bold" />
      </ToggleButton>

      <Box
        sx={[
          (theme) => ({
            minHeight: 0,
            flex: '1 1 auto',
            width: NAV_WIDTH,
            flexDirection: 'column',
            display: { xs: 'none', md: 'flex' },
            borderRight: `solid 1px ${theme.vars.palette.divider}`,
            transition: theme.transitions.create(['width'], {
              duration: theme.transitions.duration.shorter,
            }),
            ...(collapseDesktop && { width: NAV_COLLAPSE_WIDTH }),
          }),
        ]}
      >
        {renderContent()}
      </Box>

      <Drawer
        open={openMobile}
        onClose={onCloseMobile}
        slotProps={{
          backdrop: { invisible: true },
          paper: { sx: { width: NAV_WIDTH } },
        }}
      >
        {renderContent()}
      </Drawer>
    </>
  );
}
