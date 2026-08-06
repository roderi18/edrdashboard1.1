import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { Iconify } from 'src/components/iconify';

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
  const presenceStatuses = usePresenceStatuses(
    results.map((result) => result.idMiembros ?? result.id)
  );

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
                <Iconify icon="solar:chat-round-dots-bold" width={24} />
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
