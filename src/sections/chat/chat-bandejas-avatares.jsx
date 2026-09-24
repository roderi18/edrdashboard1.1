import { useRef, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import ButtonBase from '@mui/material/ButtonBase';
import Badge, { badgeClasses } from '@mui/material/Badge';

import { useGetChatUnreadSummary } from 'src/actions/chat';

import { TemblorDeAviso } from 'src/components/temblor-de-aviso';

import { useAvatarDeBuzon } from './hooks/use-buzones-del-chat';
import { useNoLeidosEnVivo } from './hooks/use-no-leidos-en-vivo';

// ----------------------------------------------------------------------
// LAS BANDEJAS DEL CHAT, EN CIRCULOS (pantalla pequeña).
//
// Arriba viven como pestañas —"Mis chats", "Chats de la Tienda"...—, y en el
// celular esa fila se comia una franja entera de una pantalla donde lo que se
// quiere ver son los mensajes. Aqui son la misma cosa dicha con fotos, al lado
// de la que ya encabeza la lista, y lo pendiente de cada una sale en el
// circulito de arriba a la derecha, como en cualquier aplicacion de mensajes.
//
// SOLO LAS QUE NO ESTAN ABIERTAS. La bandeja abierta ya ES la foto grande de la
// izquierda —la cuenta en "Mis chats", el buzon en el suyo—: ponerla tambien
// aqui enseñaba a la misma persona dos veces seguidas. Entrar a otra no añade
// una foto, cambia la de la izquierda.
//
// La fila se arrastra porque puede no caber: quien atienda mas buzones no debe
// perderlos de vista detras del borde.
// ----------------------------------------------------------------------

const MIS_CHATS = '';

const TAMANO = 36;

// Un tiron del raton mueve la fila, pero NO debe abrir la bandeja que quedo
// debajo del dedo al soltar: se apunta si hubo arrastre y el clic siguiente se
// descarta. En tactil no se toca nada —el navegador ya desliza solo, y moverle
// el `scrollLeft` a mano mientras tanto lo hacia temblar—.
function useArrastreHorizontal() {
  const ref = useRef(null);
  const arrastre = useRef(null);
  const huboArrastre = useRef(false);

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'touch' || !ref.current) return;

    huboArrastre.current = false;
    arrastre.current = { x: event.clientX, desde: ref.current.scrollLeft };
  }, []);

  const onPointerMove = useCallback((event) => {
    if (!arrastre.current || !ref.current) return;

    const avance = event.clientX - arrastre.current.x;

    if (Math.abs(avance) > 3) huboArrastre.current = true;

    ref.current.scrollLeft = arrastre.current.desde - avance;
  }, []);

  const onPointerUp = useCallback(() => {
    arrastre.current = null;
  }, []);

  const onClickCapture = useCallback((event) => {
    if (!huboArrastre.current) return;

    huboArrastre.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return { ref, onPointerDown, onPointerMove, onPointerUp, onClickCapture };
}

// Es un componente aparte porque cuenta con un gancho, y los ganchos no pueden
// ir dentro de un bucle.
function CirculoDeBandeja({ nombre, foto, idMiembros, vibraSiHayPendientes = false, onPulsar }) {
  // El número sale de la escucha en vivo (al instante); el resumen del servidor
  // solo mientras no está lista o si falla. Los avisos de "sin respuesta" los
  // sigue disparando el resumen del panel, que para los buzones no se quita.
  const enVivo = useNoLeidosEnVivo([idMiembros]);
  const { unreadConversationCount: delServidor } = useGetChatUnreadSummary(
    idMiembros,
    !enVivo.listo
  );
  const pendientes = enVivo.listo
    ? Object.keys(enVivo.unreadByConversation).length
    : delServidor;

  return (
    <Tooltip title={`Ir a ${nombre}`}>
      {/* El temblor envuelve a la insignia, no solo a la foto: va pegada a ella
          y sacudir solo la foto dejaba el numero flotando en su sitio. */}
      <TemblorDeAviso activo={vibraSiHayPendientes && pendientes > 0}>
        <Badge
          color="error"
          overlap="circular"
          badgeContent={pendientes}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{
            flexShrink: 0,
            [`& .${badgeClasses.badge}`]: { fontSize: 10, minWidth: 16, height: 16 },
          }}
        >
          <ButtonBase
            aria-label={`Ir a ${nombre}`}
            onClick={onPulsar}
            sx={(theme) => ({
              p: '2px',
              borderRadius: '50%',
              opacity: 0.8,
              transition: theme.transitions.create(['opacity'], {
                duration: theme.transitions.duration.shorter,
              }),
              '&:hover, &:focus-visible': { opacity: 1 },
            })}
          >
            <Avatar alt={nombre} src={foto} sx={{ width: TAMANO, height: TAMANO }}>
              {nombre.charAt(0).toUpperCase()}
            </Avatar>
          </ButtonBase>
        </Badge>
      </TemblorDeAviso>
    </Tooltip>
  );
}

// La foto del buzon se lee en vivo: el Administrador Global la cambia y todas
// las pantallas la ven al momento, esta incluida.
function CirculoDeBuzon({ buzon, onPulsar }) {
  const foto = useAvatarDeBuzon(buzon);

  return (
    <CirculoDeBandeja
      nombre={buzon.nombre}
      foto={foto}
      idMiembros={buzon.idMiembros}
      // Solo los buzones tiemblan: son de un cargo, no de una persona, y lo que
      // les escriben se queda esperando a que alguien se dé por aludido. Lo
      // propio ya avisa por su cuenta —suena, y esta en la campana—.
      vibraSiHayPendientes
      onPulsar={onPulsar}
    />
  );
}

export function ChatBandejasAvatares({
  buzones = [],
  bandeja = MIS_CHATS,
  contactoPropio,
  onCambiar,
  sx,
}) {
  const arrastre = useArrastreHorizontal();

  if (!buzones.length) return null;

  return (
    <Box
      ref={arrastre.ref}
      onPointerDown={arrastre.onPointerDown}
      onPointerMove={arrastre.onPointerMove}
      onPointerUp={arrastre.onPointerUp}
      onPointerLeave={arrastre.onPointerUp}
      onClickCapture={arrastre.onClickCapture}
      sx={[
        {
          gap: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* "Mis chats" solo desde un buzon: en ella, la foto grande ya es esta. */}
      {!!bandeja && (
        <CirculoDeBandeja
          nombre="Mis chats"
          foto={contactoPropio?.avatarUrl}
          idMiembros={contactoPropio?.idMiembros}
          onPulsar={() => onCambiar?.(MIS_CHATS)}
        />
      )}

      {buzones
        .filter((buzon) => buzon.clave !== bandeja)
        .map((buzon) => (
          <CirculoDeBuzon
            key={buzon.clave}
            buzon={buzon}
            onPulsar={() => onCambiar?.(buzon.clave)}
          />
        ))}
    </Box>
  );
}
