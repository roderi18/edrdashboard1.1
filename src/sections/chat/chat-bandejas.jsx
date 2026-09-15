import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';

import { useGetChatUnreadSummary } from 'src/actions/chat';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LAS BANDEJAS DEL CHAT: "Mis chats" y un buzon compartido por cada uno que
// atienda esta sesion (Tienda Virtual, Oficina Nacional...).
//
// Nacio como dos pestañas escritas a mano para la Tienda. Ahora se construye de
// la lista de buzones y de los permisos de quien mira: el Administrador de
// Tienda ve la Tienda, la Oficina Nacional ve la suya y el Administrador Global
// ve las dos. Quien no atiende ninguno no ve pestañas: no tiene nada que elegir.
// ----------------------------------------------------------------------

const MIS_CHATS = 'mios';

// Cada pestaña lleva lo pendiente de SU buzon: sin esto habia que entrar a mirar
// si alguien habia escrito. Es un componente aparte porque cuenta con un gancho,
// y los ganchos no pueden ir dentro de un bucle.
// `value` tiene que ir EN el elemento (`<TabDeBuzon value=...>`), no puesto por
// dentro: `Tabs` lo lee de sus hijos directos, y sin el les daba un indice (1, 2)
// y avisaba de que "tienda" no casaba con ninguna pestaña.
function TabDeBuzon({ buzon, ...other }) {
  const { unreadConversationCount: pendientes } = useGetChatUnreadSummary(buzon.idMiembros, true);

  return (
    <Tab
      {...other}
      iconPosition="start"
      icon={<Iconify width={20} icon={buzon.icono} />}
      label={
        pendientes > 0 ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <span>{buzon.etiquetaBandeja}</span>
            <Label variant="filled" color="error">
              {pendientes}
            </Label>
          </Stack>
        ) : (
          buzon.etiquetaBandeja
        )
      }
    />
  );
}

export function ChatBandejas({ buzones = [], bandeja = '', onCambiar, sx }) {
  if (!buzones.length) return null;

  return (
    <Tabs
      value={bandeja || MIS_CHATS}
      onChange={(event, valor) => onCambiar?.(valor === MIS_CHATS ? '' : valor)}
      variant="scrollable"
      allowScrollButtonsMobile
      sx={sx}
    >
      <Tab
        value={MIS_CHATS}
        label="Mis chats"
        iconPosition="start"
        icon={<Iconify width={20} icon="solar:chat-round-dots-bold" />}
      />

      {buzones.map((buzon) => (
        <TabDeBuzon key={buzon.clave} value={buzon.clave} buzon={buzon} />
      ))}
    </Tabs>
  );
}
