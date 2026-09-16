import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import AvatarGroup from '@mui/material/AvatarGroup';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { getNavItem } from './utils/get-nav-item';
import { usePresenceStatuses } from './hooks/use-presence-status';

// ----------------------------------------------------------------------

export function ChatNavSearchResults({
  query,
  results,
  conversationResults = [],
  currentMemberId,
  onClickResult,
  onClickConversationResult,
}) {
  const totalResults = results.length + conversationResults.length;
  // La presencia de TODOS los que salen: los contactos y los de cada
  // conversacion. Sin los segundos, la misma persona salia conectada en la lista
  // de contactos y gris justo debajo, en su conversacion.
  const idsQueSalen = useMemo(
    () => [
      ...results.map((result) => result.idMiembros ?? result.id),
      ...conversationResults.flatMap((conversation) =>
        (conversation.participants ?? []).map(
          (participante) => participante.idMiembros ?? participante.id
        )
      ),
    ],
    [results, conversationResults]
  );
  const presenceStatuses = usePresenceStatuses(idsQueSalen);

  const notFound = !totalResults && !!query;

  const renderNotFound = () => (
    <Box
      sx={{
        p: 3,
        mx: 'auto',
        width: `calc(100% - 40px)`,
        borderRadius: 1.5,
        textAlign: 'center',
        bgcolor: 'background.neutral',
      }}
    >
      <Typography variant="h6">Sin resultados</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No se encontraron contactos para <strong>{`"${query}"`}</strong>.
      </Typography>
    </Box>
  );

  const renderContactResults = () => (
    <>
      <Typography variant="subtitle2" sx={{ px: 2.5, pt: 1, pb: 0.5 }}>
        Contactos ({results.length})
      </Typography>
      <Box component="ul" sx={{ '& li': { display: 'flex' } }}>
        {results.map((result, index) => (
          <li key={`${result.id ?? result.idMiembros ?? result.codigoMiembro ?? result.name ?? 'contacto'}-${index}`}>
            <ListItemButton
              onClick={() => onClickResult(result)}
              sx={{
                gap: 2,
                py: 1.5,
                px: 2.5,
                typography: 'subtitle2',
              }}
            >
              <Badge
                variant={
                  presenceStatuses[String(result.idMiembros ?? result.id)]?.status ??
                  result.status ??
                  'offline'
                }
                badgeContent=" "
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <Avatar alt={result.name} src={result.avatarUrl} />
              </Badge>
              {result.name}
            </ListItemButton>
          </li>
        ))}
      </Box>
    </>
  );

  // LA CARA DE CON QUIEN SE HABLA, igual que en la lista de conversaciones.
  //
  // Cada resultado llevaba el mismo globito de chat: una columna de iconos
  // identicos donde hay que leer el nombre entero para saber cual es cual. Las
  // fotos se reconocen de un vistazo, que es justo lo que se esta haciendo al
  // buscar.
  const renderFotoDeLaConversacion = ({ group, participants }) => {
    const acompanante = participants[0];

    if (group) {
      return (
        <AvatarGroup variant="compact" sx={{ width: 40, height: 40 }}>
          {participants.slice(0, 2).map((participante, index) => (
            <Avatar
              slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
              key={`${participante.id ?? participante.idMiembros ?? participante.name ?? 'participante'}-${index}`}
              alt={participante.name}
              src={participante.avatarUrl}
            />
          ))}
        </AvatarGroup>
      );
    }

    return (
      <Badge
        variant={
          presenceStatuses[String(acompanante?.idMiembros ?? acompanante?.id)]?.status ?? 'offline'
        }
        badgeContent=" "
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Avatar
          slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
          alt={acompanante?.name}
          src={acompanante?.avatarUrl}
        />
      </Badge>
    );
  };

  const renderConversationResults = () => (
    <>
      <Typography variant="subtitle2" sx={{ px: 2.5, pt: 1, pb: 0.5 }}>
        Conversaciones y mensajes recientes ({conversationResults.length})
      </Typography>
      <Box component="ul" sx={{ '& li': { display: 'flex' } }}>
        {conversationResults.map((conversation) => {
          const navItem = getNavItem({ conversation, currentUserId: currentMemberId });

          return (
            <li key={conversation.id}>
              <ListItemButton
                onClick={() => onClickConversationResult(conversation)}
                sx={{ gap: 2, py: 1.25, px: 2.5 }}
              >
                {renderFotoDeLaConversacion(navItem)}
                <ListItemText
                  primary={navItem.displayName}
                  secondary={navItem.displayText}
                  slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                />
              </ListItemButton>
            </li>
          );
        })}
      </Box>
    </>
  );

  return (
    <>
      <Typography variant="h6" sx={{ px: 2.5, mb: 1 }}>
        Resultados ({totalResults})
      </Typography>

      {notFound ? (
        renderNotFound()
      ) : (
        <nav aria-label="Resultados de búsqueda del chat">
          {!!conversationResults.length && renderConversationResults()}
          {!!results.length && renderContactResults()}
        </nav>
      )}
    </>
  );
}
