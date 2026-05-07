import { uuidv4 } from 'minimal-shared/utils';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';

import { fSub } from 'src/utils/format-time';

import { createConversation } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { useAuthContext } from 'src/auth/hooks';

import { FileManagerInvitedItem } from './file-manager-invited-item';
import { getFileManagerShareLink, getFileManagerShareLabel } from './utils/share-link';

// ----------------------------------------------------------------------

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const getIdentityKeys = (source = {}) =>
  [
    source.idMiembros,
    source.id,
    source.memberId,
    source.codigoMiembro,
    source.codigoUsuario,
    source.correo,
    source.email,
  ]
    .filter(Boolean)
    .flatMap((value) => {
      const normalizedValue = normalizeKey(value);
      const emailUser = normalizedValue.includes('@') ? normalizedValue.split('@')[0] : '';

      return [normalizedValue, emailUser].filter(Boolean);
    });

const isSameContact = (a = {}, b = {}) => {
  const aKeys = new Set(getIdentityKeys(a));

  return getIdentityKeys(b).some((key) => aKeys.has(key));
};

const findCurrentContact = (contacts = [], user = {}) =>
  contacts.find((contact) => isSameContact(contact, user)) || null;

const buildMessage = ({ item, shareUrl, note }) => {
  const label = getFileManagerShareLabel(item);
  const trimmedNote = String(note || '').trim();

  return {
    id: uuidv4(),
    attachments: [],
    body: label,
    contentType: 'text',
    createdAt: fSub({ seconds: 1 }),
    metadata: {
      sharedFile: {
        name: label,
        url: shareUrl,
        ...(trimmedNote && { message: trimmedNote }),
      },
    },
  };
};

// ----------------------------------------------------------------------

export function FileManagerShareDialog({
  sx,
  item,
  open,
  shared,
  onClose,
  onCopyLink,
  ...other
}) {
  const { user } = useAuthContext();
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [shareMessage, setShareMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const hasShared = shared && !!shared.length;
  const shareUrl = useMemo(() => getFileManagerShareLink(item), [item]);
  const shareLabel = useMemo(() => getFileManagerShareLabel(item), [item]);
  const currentContact = useMemo(() => findCurrentContact(contacts, user), [contacts, user]);
  const recipientOptions = useMemo(
    () => contacts.filter((contact) => !isSameContact(contact, currentContact || user)),
    [contacts, currentContact, user]
  );

  useEffect(() => {
    let active = true;

    if (!open) {
      setSelectedContacts([]);
      setShareMessage('');
      return undefined;
    }

    const loadContacts = async () => {
      const response = await fetch('/api/chat/?endpoint=contacts', { cache: 'no-store' }).catch(
        () => null
      );

      if (!active || !response?.ok) {
        return;
      }

      const payload = await response.json().catch(() => ({}));

      if (active) {
        setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
      }
    };

    loadContacts();

    return () => {
      active = false;
    };
  }, [open]);

  const handleCopyLink = useCallback(() => {
    if (onCopyLink) {
      onCopyLink(shareUrl);
      return;
    }

    navigator.clipboard?.writeText(shareUrl);
    toast.success('Link copiado.');
  }, [onCopyLink, shareUrl]);

  const handleSendToMessages = useCallback(async () => {
    if (!currentContact?.idMiembros) {
      toast.error('No se pudo identificar tu usuario para enviar el mensaje.');
      return;
    }

    if (!selectedContacts.length) {
      toast.error('Selecciona al menos un miembro.');
      return;
    }

    setIsSending(true);

    try {
      await Promise.all(
        selectedContacts.map((recipient) => {
          const message = {
            ...buildMessage({ item, shareUrl, note: shareMessage }),
            senderId: String(currentContact.idMiembros),
          };

          return createConversation(
            {
              id: recipient.id,
              messages: [message],
              participants: [recipient, currentContact],
              type: 'ONE_TO_ONE',
              unreadCount: 0,
            },
            currentContact.idMiembros
          );
        })
      );

      toast.success('Enviado a mensajes.');
      setSelectedContacts([]);
      setShareMessage('');
      onClose?.();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo enviar a mensajes.');
    } finally {
      setIsSending(false);
    }
  }, [currentContact, item, onClose, selectedContacts, shareMessage, shareUrl]);

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} sx={sx} {...other}>
      <DialogTitle>Compartir</DialogTitle>

      <Box sx={{ px: 3, pb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Link del elemento
        </Typography>

        <Box
          sx={{
            mt: 0.75,
            mb: 2,
            px: 1.5,
            py: 1,
            gap: 1,
            display: 'flex',
            borderRadius: 1,
            alignItems: 'center',
            bgcolor: 'background.neutral',
          }}
        >
          <Iconify icon="eva:link-2-fill" width={18} />
          <Typography noWrap variant="body2" sx={{ flex: 1 }}>
            {shareLabel}
          </Typography>
        </Box>

        <Autocomplete
          multiple
          options={recipientOptions}
          value={selectedContacts}
          onChange={(event, newValue) => setSelectedContacts(newValue)}
          getOptionLabel={(option) => option.name || option.codigoMiembro || ''}
          isOptionEqualToValue={(option, value) =>
            String(option.idMiembros ?? option.id) === String(value.idMiembros ?? value.id)
          }
          noOptionsText="Sin miembros"
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.idMiembros ?? option.id}>
              <Avatar src={option.avatarUrl} alt={option.name} sx={{ mr: 1.5, width: 32, height: 32 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap variant="body2">
                  {option.name}
                </Typography>
                <Typography noWrap variant="caption" sx={{ color: 'text.secondary' }}>
                  {option.codigoMiembro || option.email}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField {...params} label="Buscar miembros" placeholder="Seleccionar miembros" />
          )}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Añade un mensaje"
          value={shareMessage}
          onChange={(event) => setShareMessage(event.target.value)}
          sx={{ mb: 2 }}
        />

        <Button
          fullWidth
          variant="contained"
          loading={isSending}
          disabled={!selectedContacts.length}
          startIcon={<Iconify icon="solar:chat-round-line-bold" />}
          onClick={handleSendToMessages}
        >
          Enviar a mensajes
        </Button>
      </Box>

      {hasShared && (
        <Scrollbar sx={{ height: 60 * 5, px: 3 }}>
          <Box component="ul">
            {shared.map((person) => (
              <FileManagerInvitedItem key={person.id} person={person} />
            ))}
          </Box>
        </Scrollbar>
      )}

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button startIcon={<Iconify icon="eva:link-2-fill" />} onClick={handleCopyLink}>
          Copiar link
        </Button>

        {onClose && (
          <Button variant="outlined" color="inherit" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
