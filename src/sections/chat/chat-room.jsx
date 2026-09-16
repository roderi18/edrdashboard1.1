import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';

import { Scrollbar } from 'src/components/scrollbar';

import { ChatRoomGroup } from './chat-room-group';
import { ChatRoomSkeleton } from './chat-skeleton';
import { ChatRoomSingle } from './chat-room-single';
import { ChatRoomAttachments } from './chat-room-attachments';

// ----------------------------------------------------------------------

const NAV_WIDTH = 280;

const NAV_DRAWER_WIDTH = 320;

export function ChatRoom({
  collapseNav,
  participants,
  messages,
  loading,
  sx,
  contacts,
  currentContact,
  esGrupo = false,
  creatorIdMiembros,
  administratorIds,
  onAddParticipants,
  onRemoveParticipant,
  onLeaveGroup,
  onSetGroupAdministrator,
  onTransferGroupOwnership,
  ...other
}) {
  const { collapseDesktop, openMobile, onCloseMobile } = collapseNav;

  // CON DOS PERSONAS YA HAY LISTA QUE ENSEÑAR. Este panel sale tambien en un
  // chat de dos —para ver a quien se tiene delante y poder abrir un grupo con
  // el—; que sea un grupo DE VERDAD lo dice la conversacion, no cuanta gente
  // hay, y de eso dependen las acciones que se ofrecen.
  const hayVariosParticipantes = participants.length > 1;

  const attachments = messages.map((msg) => msg.attachments).flat(1) || [];

  const renderContent = () =>
    loading ? (
      <ChatRoomSkeleton />
    ) : (
      <Scrollbar>
        <div>
          {hayVariosParticipantes ? (
            <ChatRoomGroup
              participants={participants}
              contacts={contacts}
              currentContact={currentContact}
              esGrupo={esGrupo}
              creatorIdMiembros={creatorIdMiembros}
              administratorIds={administratorIds}
              onAddParticipants={onAddParticipants}
              onRemoveParticipant={onRemoveParticipant}
              onLeaveGroup={onLeaveGroup}
              onSetGroupAdministrator={onSetGroupAdministrator}
              onTransferGroupOwnership={onTransferGroupOwnership}
            />
          ) : (
            <ChatRoomSingle participant={participants[0]} />
          )}

          <ChatRoomAttachments attachments={attachments} />
        </div>
      </Scrollbar>
    );

  return (
    <>
      <Box
        sx={[
          (theme) => ({
            minHeight: 0,
            flex: '1 1 auto',
            width: NAV_WIDTH,
            flexDirection: 'column',
            display: { xs: 'none', lg: 'flex' },
            borderLeft: `solid 1px ${theme.vars.palette.divider}`,
            transition: theme.transitions.create(['width'], {
              duration: theme.transitions.duration.shorter,
            }),
            ...(collapseDesktop && { width: 0 }),
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        {!collapseDesktop && renderContent()}
      </Box>

      <Drawer
        anchor="right"
        open={openMobile}
        onClose={onCloseMobile}
        slotProps={{
          backdrop: { invisible: true },
          paper: { sx: { width: NAV_DRAWER_WIDTH } },
        }}
      >
        {renderContent()}
      </Drawer>
    </>
  );
}
