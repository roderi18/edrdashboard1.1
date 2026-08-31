import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import SvgIcon from '@mui/material/SvgIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';

import { useRouter } from 'src/routes/hooks';

import { fToNow } from 'src/utils/format-time';

import {
  esNotificacionDeCumpleanos,
  enviarFelicitacionDeCumpleanos,
} from 'src/services/felicitaciones-cumpleanos-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';

import { useAuthContext } from 'src/auth/hooks';

import { notificationIcons } from './icons';

// ----------------------------------------------------------------------

const readerContent = (data) => (
  <Box
    dangerouslySetInnerHTML={{ __html: data }}
    sx={{
      '& p': { m: 0, typography: 'body2' },
      '& a': { color: 'inherit', textDecoration: 'none' },
      '& strong': { typography: 'subtitle2' },
    }}
  />
);

const renderIcon = (type) =>
  ({
    order: notificationIcons.order,
    chat: notificationIcons.chat,
    mail: notificationIcons.mail,
    delivery: notificationIcons.delivery,
  })[type];

const getNotificationRoute = (notification = {}) => {
  const idConversacion =
    notification.metadatos?.idConversacion ||
    notification.metadatos?.conversationId ||
    notification.metadatos?.idConversation;

  if (
    idConversacion &&
    (notification.tipoNotificacion === 'mensaje_recibido' ||
      notification.metadatos?.estadoEvaluacion)
  ) {
    return `/dashboard/chat?id=${idConversacion}`;
  }

  if (
    ['pedido_recibido', 'pedido_creado'].includes(notification.tipoNotificacion) &&
    notification.metadatos?.numeroOrden
  ) {
    return `/dashboard/order/${notification.metadatos.numeroOrden}`;
  }

  if (notification.tipoNotificacion === 'producto_resena_baja') {
    const productId =
      notification.metadatos?.productId ||
      notification.metadatos?.idProducto ||
      notification.entidadId;
    const reviewId = notification.metadatos?.reviewId;

    if (productId && reviewId) {
      return `/dashboard/product/${productId}?tab=reviews&reviewId=${encodeURIComponent(String(reviewId))}`;
    }
  }

  return notification.ruta;
};

const getNotificationActionLabel = (notification = {}) => {
  if (notification.tipoNotificacion === 'publicacion_reportada') return 'Revisar publicación';
  if (['miembro_creado', 'miembro_actualizado'].includes(notification.tipoNotificacion)) {
    return 'Ver miembro';
  }
  if (['factura_generada', 'factura_disponible'].includes(notification.tipoNotificacion)) {
    return 'Abrir factura';
  }
  if (notification.tipoNotificacion === 'error_subida_archivo_imagen') return 'Resolver error';

  return notification.etiquetaAccion || (notification.ruta ? 'Abrir' : '');
};

export function NotificationItem({ notification, onClickNotification, onMarkAsAttended }) {
  const { user } = useAuthContext();
  const [enviandoFelicitacion, setEnviandoFelicitacion] = useState(false);
  const router = useRouter();
  const notificationRoute = getNotificationRoute(notification);
  const actionLabel = getNotificationActionLabel(notification);

  // La solicitud llega a los dos coordinadores: si uno ya la resolvio, el otro
  // tiene que verlo o acaba generando un segundo codigo y tumbando el primero.
  const solicitudYaAtendida =
    notification.tipoNotificacion === 'recuperacion_clave_miembro' &&
    notification.estado === 'atendida';
  const quienAtendio = notification.metadatos?.atendidaPorNombre || '';
  const atendidaPorCodigo = notification.metadatos?.atendidaMotivo === 'codigo_generado';
  const avisoAtendida = solicitudYaAtendida
    ? [
      'Esta solicitud ya fue atendida',
      quienAtendio ? ` por ${quienAtendio}` : '',
      atendidaPorCodigo
        ? ': ya se le generó un código. Generar otro anularía el suyo.'
        : ': el miembro ya volvió a entrar a su cuenta.',
    ].join('')
    : '';

  const handleClickNotification = async () => {
    if (solicitudYaAtendida) {
      toast.info(avisoAtendida);
    }

    await onClickNotification?.(notification);

    if (notificationRoute) {
      router.push(notificationRoute);
    }
  };

  const handlePrimaryAction = async (event) => {
    event.stopPropagation();
    await handleClickNotification();
  };

  const handleAttendAction = (event) => {
    event.stopPropagation();
    // Sin await: la fila cambia en el acto y el guardado va por detras.
    onMarkAsAttended?.(notification);
  };

  // En un cumpleaños no hay nada que "atender": hay a quien felicitar. El boton
  // manda por el chat un mensaje de la lista, elegido al azar, de parte de quien
  // pulsa. La fila se marca como atendida despues, para que se vea que ya
  // felicito y no lo haga dos veces sin querer.
  const esCumpleanos = esNotificacionDeCumpleanos(notification);

  const handleFelicitar = (event) => {
    event.stopPropagation();

    if (enviandoFelicitacion) return;

    setEnviandoFelicitacion(true);

    try {
      // El mensaje ya esta elegido en este mismo instante: se dice y se marca la
      // fila enseguida. El viaje al servidor va por detras.
      const enviada = enviarFelicitacionDeCumpleanos({
        notificacion: notification,
        usuario: user,
      });

      toast.success(`Felicitación enviada: “${enviada.texto}”`);
      onMarkAsAttended?.(notification);

      // Pero si la entrega falla, se dice. Dar por enviado algo que no salio
      // seria mentir, y el cumpleañero no recibiria nada.
      enviada.entrega
        .catch((error) => {
          toast.error(
            error?.message || 'No se pudo enviar la felicitación. Vuelve a intentarlo.'
          );
        })
        .finally(() => setEnviandoFelicitacion(false));
    } catch (error) {
      // Lo que se comprueba antes de salir: sin cumpleañero, sin cuenta, o es su
      // propio cumpleaños.
      toast.error(error?.message || 'No se pudo enviar la felicitación.');
      setEnviandoFelicitacion(false);
    }
  };

  const renderAvatar = () => (
    <ListItemAvatar>
      {notification.avatarUrl ? (
        <Avatar
          src={notification.avatarUrl}
          slotProps={{
            img: {
              loading: 'eager',
              decoding: 'async',
              referrerPolicy: 'no-referrer',
            },
          }}
          sx={{ bgcolor: 'background.neutral' }}
        />
      ) : (
        <Box
          sx={{
            width: 40,
            height: 40,
            display: 'flex',
            borderRadius: '50%',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.neutral',
          }}
        >
          <SvgIcon sx={{ width: 24, height: 24 }}>{renderIcon(notification.type)}</SvgIcon>
        </Box>
      )}
    </ListItemAvatar>
  );

  const isCritical = notification.prioridad === 'critica';

  const renderText = () => (
    <ListItemText
      primary={
        <Box sx={{ gap: 0.75, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {readerContent(notification.title)}
          {isCritical && (
            <Iconify
              icon="solar:danger-triangle-bold"
              width={18}
              sx={{ mt: 0.25, color: 'warning.main', flexShrink: 0 }}
            />
          )}
        </Box>
      }
      secondary={
        <>
          {fToNow(notification.createdAt)}
          <Box
            component="span"
            sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'currentColor' }}
          />
          {notification.category}

          {solicitudYaAtendida && (
            <Box component="span" sx={{ color: 'success.main', fontWeight: 'fontWeightSemiBold' }}>
              · {quienAtendio ? `Atendida por ${quienAtendio}` : 'Ya atendida'}
            </Box>
          )}
        </>
      }
      slotProps={{
        primary: {
          sx: { mb: 0.5 },
        },
        secondary: {
          sx: {
            gap: 0.5,
            display: 'flex',
            alignItems: 'center',
            typography: 'caption',
            color: 'text.disabled',
          },
        },
      }}
    />
  );

  const renderUnReadBadge = () =>
    notification.isUnRead && (
      <Box
        sx={{
          top: 26,
          width: 8,
          height: 8,
          right: 20,
          borderRadius: '50%',
          bgcolor: 'info.main',
          position: 'absolute',
        }}
      />
    );

  const renderFriendAction = () => (
    <Box sx={{ gap: 1, mt: 1.5, display: 'flex' }}>
      <Button size="small" variant="contained">
        Accept
      </Button>
      <Button size="small" variant="outlined">
        Decline
      </Button>
    </Box>
  );

  const renderProjectAction = () => (
    <>
      <Box
        sx={{
          p: 1.5,
          my: 1.5,
          borderRadius: 1.5,
          color: 'text.secondary',
          bgcolor: 'background.neutral',
        }}
      >
        {readerContent(
          `<p><strong>@Roderi Peña</strong> feedback by asking questions or just leave a note of appreciation.</p>`
        )}
      </Box>

      <Button size="small" variant="contained" sx={{ alignSelf: 'flex-start' }}>
        Reply
      </Button>
    </>
  );

  const renderFileAction = () => (
    <Box
      sx={(theme) => ({
        p: theme.spacing(1.5, 1.5, 1.5, 1),
        gap: 1,
        mt: 1.5,
        display: 'flex',
        borderRadius: 1.5,
        bgcolor: 'background.neutral',
      })}
    >
      <FileThumbnail file="design-suriname-2015.mp3" />

      <ListItemText
        primary="design-suriname-2015.mp3 design-suriname-2015.mp3"
        secondary="2.3 Mb"
        slotProps={{
          primary: {
            noWrap: true,
            sx: (theme) => ({
              color: 'text.secondary',
              fontSize: theme.typography.pxToRem(13),
            }),
          },
          secondary: {
            sx: {
              mt: 0.25,
              typography: 'caption',
              color: 'text.disabled',
            },
          },
        }}
      />

      <Button size="small" variant="outlined" sx={{ flexShrink: 0 }}>
        Download
      </Button>
    </Box>
  );

  const renderTagsAction = () => (
    <Box
      sx={{
        mt: 1.5,
        gap: 0.75,
        display: 'flex',
        flexWrap: 'wrap',
      }}
    >
      <Label variant="outlined" color="info">
        Design
      </Label>
      <Label variant="outlined" color="warning">
        Dashboard
      </Label>
      <Label variant="outlined">Design system</Label>
    </Box>
  );

  const renderPaymentAction = () => (
    <Box sx={{ gap: 1, mt: 1.5, display: 'flex' }}>
      <Button size="small" variant="contained">
        Pay
      </Button>
      <Button size="small" variant="outlined">
        Decline
      </Button>
    </Box>
  );

  const yaAtendida = notification.estado === 'atendida';

  const renderNotificationActions = () => (
    <Box sx={{ gap: 1, mt: 1.5, display: 'flex', flexWrap: 'wrap' }}>
      {!!actionLabel && notificationRoute && !solicitudYaAtendida && (
        <Button size="small" variant="contained" onClick={handlePrimaryAction}>
          {actionLabel}
        </Button>
      )}

      {/* Atendida, el boton NO desaparece: se queda diciendo que ya lo esta. Al
          esfumarse, la fila quedaba igual que una sin atender y no habia forma
          de saber si el clic habia hecho algo. Mismas props que el boton de
          accion —sin fijar color— para que herede el del tema, y sin `disabled`,
          que lo apagaria en gris: no esta deshabilitado, es un estado. */}
      {yaAtendida ? (
        <Button
          size="small"
          variant="contained"
          disableRipple
          startIcon={<Iconify width={16} icon="eva:checkmark-fill" />}
          sx={{ pointerEvents: 'none' }}
        >
          {esCumpleanos ? 'Felicitación enviada' : 'Atendido'}
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          disabled={enviandoFelicitacion}
          startIcon={esCumpleanos ? <Iconify width={16} icon="solar:gift-bold" /> : null}
          onClick={esCumpleanos ? handleFelicitar : handleAttendAction}
        >
          {esCumpleanos
            ? (enviandoFelicitacion && 'Enviando...') || 'Mensaje de felicitaciones'
            : 'Marcar como atendida'}
        </Button>
      )}
    </Box>
  );

  return (
    <ListItemButton
      disableRipple
      onClick={handleClickNotification}
      sx={[
        (theme) => ({
          p: 2.5,
          alignItems: 'flex-start',
          cursor: notificationRoute ? 'pointer' : 'default',
          borderBottom: `dashed 1px ${theme.vars.palette.divider}`,
        }),
      ]}
    >
      {renderUnReadBadge()}
      {renderAvatar()}

      <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
        {renderText()}
        {notification.type === 'friend' && renderFriendAction()}
        {notification.type === 'project' && renderProjectAction()}
        {notification.type === 'file' && renderFileAction()}
        {notification.type === 'tags' && renderTagsAction()}
        {notification.type === 'payment' && renderPaymentAction()}
        {renderNotificationActions()}
      </Box>
    </ListItemButton>
  );
}
