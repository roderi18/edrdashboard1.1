import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import {
  mensajeCompartirProducto,
  tarjetaProductoCompartido,
  destinatariosParaCompartir,
} from 'src/utils/producto-favorito-compartir.mjs';

import { useGetContacts, createConversation } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { initialConversation } from '../chat/utils/initial-conversation';
import { useChatCurrentContact } from '../chat/hooks/use-chat-current-contact';

// ----------------------------------------------------------------------
// COMPARTIR UN PRODUCTO POR EL CHAT.
//
// Se elige a la persona en un desplegable y el enlace le llega a su chat, sin
// salir de la ficha. Reutiliza lo que ya hace el chat: los mismos contactos, el
// mismo mensaje de `initialConversation` y `createConversation`, que en una
// conversacion de dos que ya existe no crea otra: añade el mensaje a la de
// siempre. Asi el producto cae en el hilo que ya tienen, no en uno nuevo.
// ----------------------------------------------------------------------

export function ProductShareChatDialog({ open, onClose, product }) {
  const { user } = useAuthContext();

  // Los contactos solo se piden con el dialogo abierto: la ficha no los necesita.
  const { contacts, contactsLoading } = useGetContacts(Boolean(open && user?.accessToken));
  const yo = useChatCurrentContact(contacts);

  const [destinatario, setDestinatario] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const opciones = useMemo(() => destinatariosParaCompartir(contacts, yo), [contacts, yo]);

  useEffect(() => {
    if (!open) setDestinatario(null);
  }, [open]);

  const urlDelProducto = () =>
    typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';

  // Para compartirlo fuera del chat —WhatsApp, un correo—: el enlace a la ficha.
  const handleCopiarUrl = async () => {
    try {
      await navigator.clipboard.writeText(urlDelProducto());
      toast.success('URL copiada.');
    } catch (error) {
      console.error('[producto] no se pudo copiar la URL', error);
      toast.error('No se pudo copiar la URL.');
    }
  };

  const handleEnviar = async () => {
    if (!destinatario) return;

    const url = urlDelProducto();
    // El texto queda de respaldo —la vista previa de la lista de chats y los
    // avisos lo leen—; lo que se ve en la conversacion es la tarjeta.
    const { messageData, conversationData } = initialConversation({
      message: mensajeCompartirProducto({ nombre: product?.name, url }),
      recipients: [destinatario],
      me: yo,
    });
    const tarjeta = tarjetaProductoCompartido(product);

    if (tarjeta) {
      conversationData.messages = [{ ...messageData, metadata: { sharedProduct: tarjeta } }];
    }

    setEnviando(true);

    try {
      await createConversation(conversationData, yo.idMiembros);

      toast.success(`Producto enviado a ${destinatario.name}.`);
      onClose?.();
    } catch (error) {
      console.error('[producto] no se pudo compartir por el chat', error);
      toast.error(error?.message || 'No se pudo enviar el producto por el chat.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={enviando ? undefined : onClose}>
      <DialogTitle>Compartir producto</DialogTitle>

      <DialogContent sx={{ overflow: 'unset' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Elige a quién enviarle <strong>{product?.name || 'este producto'}</strong>. Le llegará a
          su chat con el enlace.
        </Typography>

        <Autocomplete
          value={destinatario}
          options={opciones}
          loading={contactsLoading}
          onChange={(event, valor) => setDestinatario(valor)}
          getOptionLabel={(opcion) => opcion?.name || ''}
          isOptionEqualToValue={(opcion, valor) => String(opcion.id) === String(valor.id)}
          loadingText="Cargando contactos…"
          noOptionsText="No se encontraron contactos"
          renderInput={(params) => (
            <TextField {...params} autoFocus label="Enviar a" placeholder="Buscar persona" />
          )}
          renderOption={(props, opcion) => {
            const { key, ...otrasProps } = props;

            return (
              <li key={key} {...otrasProps}>
                <Avatar
                  alt={opcion.name}
                  src={opcion.avatarUrl}
                  sx={{ width: 32, height: 32, mr: 1.5 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {opcion.name}
                  </Typography>
                </Box>
              </li>
            );
          }}
        />

        {/* El chat escribe a nombre del numero de miembro: sin el no hay
            conversacion que crear, y el boton quedaba gris sin decir por que. */}
        {!contactsLoading && !yo?.idMiembros && (
          <Typography variant="caption" component="div" sx={{ color: 'error.main', mt: 1 }}>
            Tu cuenta no tiene chat, así que no puede enviar productos.
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        {/* A la izquierda, separado de las dos acciones del chat. */}
        <Button
          color="inherit"
          onClick={handleCopiarUrl}
          startIcon={<Iconify icon="solar:copy-bold" width={18} />}
          sx={{ mr: 'auto' }}
        >
          Copiar URL
        </Button>

        <Button variant="outlined" color="inherit" onClick={onClose} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleEnviar}
          disabled={!destinatario || enviando || !yo?.idMiembros}
          loading={enviando}
        >
          Enviar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
