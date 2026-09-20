import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fToNow } from 'src/utils/format-time';
import { fDopCurrency } from 'src/utils/format-number';
import { fraseDeCumpleanos } from 'src/utils/chat-sistema.mjs';
import { toggleChatReaction } from 'src/utils/chat-reaction-core.mjs';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';
import { UnderlineLink } from 'src/components/link/underline-link';
import { detectFileFormat } from 'src/components/file-thumbnail/utils';
import { PanelDeEmojis } from 'src/components/emoji/selector-de-emojis';

import { getMessage } from './utils/get-message';
import { pesoDeArchivo } from './utils/peso-de-archivo.mjs';
import { ESTILO_DE_MENCION } from './utils/estilo-de-mencion';
import { buildReactionGroups } from './utils/reaction-groups.mjs';
import { partirPorMenciones, nombresMencionables } from './utils/menciones-en-el-texto.mjs';

// ----------------------------------------------------------------------

// LAS TRES FORMAS QUE CONVIVEN. Los pedidos nuevos son "ORD-26-0148"
// —correlativo del año—, unos pocos salieron como "REC-26-0001" y los antiguos
// se quedan con su "ORD-1777776824429": renumerarlos romperia los enlaces que ya
// se enviaron por aqui.
//
// La forma larga va PRIMERO en la alternativa: con "ORD-\d+" delante, de
// "ORD-26-0148" solo se llevaria el "ORD-26" y el enlace apuntaria a un pedido
// que no existe.
const NUMERO_DE_ORDEN = String.raw`ORD-\d{2}-\d+|REC-\d{2}-\d+|ORD-\d+`;
const ORDER_NUMBER_REGEX = new RegExp(`(${NUMERO_DE_ORDEN})`, 'g');
const ORDER_NUMBER_EXACT_REGEX = new RegExp(`^(?:${NUMERO_DE_ORDEN})$`);
const MISSING_FILE_INSTRUCTION = 'Presiona este número de orden para cargar el archivo faltante.';
const MESSAGE_DELETE_WINDOW_MS = 60 * 60 * 1000;
const EMOJI_OPTIONS = [
  '\u{1F44D}',
  '\u{2764}\u{FE0F}',
  '\u{1F602}',
  '\u{1F62E}',
  '\u{1F622}',
  '\u{1F64F}',
];

const formatChatTime = (input) => {
  const value = fToNow(input);

  if (!value || value === 'Invalid') {
    return value;
  }

  return value.toLowerCase().startsWith('hace ') ? value : `hace ${value}`;
};

// Donde estan las menciones lo dice `menciones-en-el-texto.mjs`, que es la misma
// regla que sigue la caja de escribir: asi una mencion no cambia de aspecto al
// pulsar Enter. Aqui solo se pintan.
const highlightMentions = (text, participants = []) =>
  partirPorMenciones(text, nombresMencionables(participants)).map((part, index) =>
      part.esMencion ? (
        <Box
          key={`mention-${part.texto}-${index}`}
          component="span"
          sx={ESTILO_DE_MENCION}
        >
          {part.texto}
        </Box>
      ) : (
        part.texto
      )
  );

const renderMessageTextWithOrderLinks = (text = '', metadata = {}, participants = []) =>
  String(text)
    .split(ORDER_NUMBER_REGEX)
    .map((part, index) => {
      if (!ORDER_NUMBER_EXACT_REGEX.test(part)) {
        return highlightMentions(part, participants);
      }

      const orderHref = metadata?.ordenId
        ? `/dashboard/order/${encodeURIComponent(metadata.ordenId)}`
        : `${paths.dashboard.order.root}?orderNumber=${encodeURIComponent(part)}`;

      return (
        <UnderlineLink
          key={`${part}-${index}`}
          href={orderHref}
          sx={{ color: 'primary.main', fontWeight: 700 }}
        >
          {part}
        </UnderlineLink>
      );
    });

const renderSharedFileLink = (text = '', metadata = {}, participants = []) => {
  const sharedFile = metadata?.sharedFile;
  const label = String(sharedFile?.name || '').trim();
  const href = sharedFile?.url;

  if (!label || !href || String(text).trim() !== label) {
    return null;
  }

  return (
    <>
      <UnderlineLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: 'primary.main', fontWeight: 700 }}
      >
        {label}
      </UnderlineLink>

      {!!sharedFile.message && (
        <Box component="span" sx={{ display: 'block', mt: 0.75 }}>
          {renderMessageTextWithOrderLinks(sharedFile.message, metadata, participants)}
        </Box>
      )}
    </>
  );
};

// UN PRODUCTO COMPARTIDO SE VE COMO TARJETA: imagen, nombre y precio, y al
// pulsarla se va a la ficha. Antes llegaba el texto con la URL pegada, que habia
// que copiar o pulsar a ciegas.
// LOS CUMPLEAÑOS QUE ANUNCIA SISTEMA: la foto de cada persona GRANDE, como es
// —con su proporcion, sin recortarla en un circulo—, y su frase debajo ("Randy
// Samuel Cruz Martinez está de cumpleaños hoy 🎊"). En un circulo de 48px la cara
// apenas se reconocia, y es lo que importa del aviso. Pulsarla la abre ampliada,
// como las fotos enviadas. Sin foto, solo la frase. La felicitacion al propio
// cumpleañero lleva su foto y su texto.
function TarjetaDeCumpleanos({ cumpleanos, texto, onOpenLightbox }) {
  const personas = Array.isArray(cumpleanos?.personas) ? cumpleanos.personas : [];

  return (
    <Stack spacing={2}>
      {personas.map((persona) => (
        <Stack key={persona.idMiembros} spacing={1}>
          {persona.fotoUrl && (
            <Box
              component="img"
              src={persona.fotoUrl}
              alt={persona.nombre}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onClick={() => onOpenLightbox?.(persona.fotoUrl)}
              sx={{
                width: 1,
                height: 'auto',
                display: 'block',
                borderRadius: 1.5,
                cursor: onOpenLightbox ? 'pointer' : 'default',
                '&:hover': onOpenLightbox ? { opacity: 0.9 } : {},
              }}
            />
          )}
          <Typography variant="body2">
            {cumpleanos?.felicitacion ? texto : fraseDeCumpleanos(persona.nombre, persona.dias)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function TarjetaProductoCompartido({ producto }) {
  return (
    <Box
      component={RouterLink}
      href={producto.url}
      sx={{
        // Todo el ancho del globo, que lo marca el texto de encima: con un ancho
        // fijo la tarjeta quedaba mas estrecha que la frase y se veia descuadrada.
        width: 1,
        display: 'block',
        overflow: 'hidden',
        borderRadius: 1.5,
        color: 'text.primary',
        textDecoration: 'none',
        bgcolor: 'background.paper',
        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        transition: (theme) => theme.transitions.create(['box-shadow']),
        '&:hover': { boxShadow: (theme) => theme.vars.customShadows.z8 },
      }}
    >
      <Box
        sx={{
          aspectRatio: '1 / 1',
          bgcolor: 'background.neutral',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {producto.imageUrl ? (
          <Box
            component="img"
            alt={producto.name}
            src={producto.imageUrl}
            sx={{ width: 1, height: 1, objectFit: 'cover' }}
          />
        ) : (
          <Iconify icon="solar:cart-3-bold" width={40} sx={{ color: 'text.disabled' }} />
        )}
      </Box>

      <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography variant="subtitle2" noWrap title={producto.name}>
          {producto.name}
        </Typography>

        {Number.isFinite(producto.price) && (
          <Typography
            variant="subtitle2"
            sx={(theme) => ({
              mt: 0.25,
              color: 'primary.main',
              // El color principal, oscuro, no se lee sobre la tarjeta oscura.
              ...theme.applyStyles('dark', { color: 'primary.light' }),
            })}
          >
            {fDopCurrency(producto.price)}
          </Typography>
        )}

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Ver producto
        </Typography>
      </Box>
    </Box>
  );
}

// DE QUE TIPO ES EL ARCHIVO, PARA ELEGIRLE EL ICONO.
//
// Manda el tipo que declaro el navegador al subirlo, no el nombre: la gente
// renombra archivos, y un PDF llamado "Nuevo Documento de Microsoft Word.pdf"
// salia con el icono de Word. El nombre queda de reserva para los tipos que
// Windows manda a su manera —un .zip suele viajar como
// `application/x-zip-compressed`—.
const formatoDelAdjunto = (adjunto) => {
  const porTipo = detectFileFormat(adjunto?.tipo);

  return porTipo !== 'unknown' ? porTipo : detectFileFormat(adjunto?.nombre);
};

const renderMessageBodyText = (text = '', metadata = {}, participants = []) => {
  const sharedFileLink = renderSharedFileLink(text, metadata, participants);

  if (sharedFileLink) {
    return sharedFileLink;
  }

  return String(text)
    .split(MISSING_FILE_INSTRUCTION)
    .map((part, index, parts) => (
      <Box component="span" key={`message-part-${index}`} sx={{ display: 'contents' }}>
        {renderMessageTextWithOrderLinks(part, metadata, participants)}
        {index < parts.length - 1 && (
          <Typography
            component="span"
            variant="body2"
            sx={{
              display: 'block',
              mt: 1,
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          >
            {MISSING_FILE_INSTRUCTION}
          </Typography>
        )}
      </Box>
    ));
};

export function ChatMessageItem({
  message,
  participants,
  currentContact,
  onOpenLightbox,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onRestore,
  onJumpToMessage,
  highlighted = false,
}) {
  const { me, senderDetails, hasImage } = getMessage({
    message,
    participants,
    currentUserId: [currentContact.idMiembros, currentContact.id],
  });

  const { firstName, avatarUrl } = senderDetails;

  const { body, createdAt } = message;
  const attachment = message.attachments?.[0] || null;
  const imageAttachments = (message.attachments || [])
    .map((item) => item.url || item.downloadURL || item.previewUrl)
    .filter(Boolean);
  const imageUrls = hasImage
    ? imageAttachments.length
      ? imageAttachments
      : [body].filter(Boolean)
    : [];
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [showAllReactionEmojis, setShowAllReactionEmojis] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const isSent = me && message.estadoEnvio !== 'enviando';
  const deliveryStatus = message.deliveryStatus ?? message.estadoEntrega ?? 'enviado';
  const reactionGroups = buildReactionGroups({
    reactions: localReactions,
    participants,
    currentContact,
  });
  const isDeleted = message.eliminado;
  const isSystemMessage =
    message.contentType === 'system' || message.tipoContenido === 'system';
  const sentAtTime = new Date(createdAt).getTime();
  const canDeleteMessage =
    Number.isFinite(sentAtTime) && currentTime - sentAtTime <= MESSAGE_DELETE_WINDOW_MS;
  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const reactionKey = String(currentContact.idMiembros || currentContact.id || 'usuario');
  const selectedReactionEmoji = localReactions[reactionKey];

  useEffect(() => {
    setLocalReactions(message.reactions || {});
  }, [message.reactions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearTimeout(timeout);
  }, [currentTime]);

  // REACCIONAR NO ESPERA A NADIE.
  //
  // La reaccion ya se pintaba al momento, pero los botones se quedaban
  // bloqueados hasta que el servidor contestaba: se pulsaba un emoji y no se
  // podia pulsar otro, ni cambiar de idea, hasta que volviera la respuesta. Eso
  // es lo que se sentia lento, no el dibujo.
  //
  // Ahora se pinta y se sigue. Si el guardado falla, se deshace ESA reaccion
  // —la de antes de este toque, no la que haya quedado despues— y se dice.
  const handleSelectEmoji = (emoji) => {
    const previousReactions = localReactions;
    const nextReactions = toggleChatReaction(previousReactions, reactionKey, emoji);

    setEmojiAnchorEl(null);
    setShowAllReactionEmojis(false);
    setLocalReactions(nextReactions);

    Promise.resolve(onReact?.(message, emoji)).catch((error) => {
      setLocalReactions(previousReactions);
      toast.error(error?.message || 'No se pudo guardar la reacción.');
    });
  };

  const renderInfo = () => (
    <Typography
      noWrap
      variant="caption"
      sx={{ mb: 1, color: 'text.disabled', ...(!me && { mr: 'auto' }) }}
    >
      {!me && `${firstName}, `}

      {formatChatTime(createdAt)}

      {/* Quien contesto como el buzon, con su usuario. El servidor solo lo manda
          al Administrador Global cuando mira el buzon: ni el miembro ni el resto
          de quienes lo atienden reciben este dato. */}
      {message.respondidoPor &&
        ` · respondió ${message.respondidoPor}${
          message.respondidoPorUsuario ? ` (${message.respondidoPorUsuario})` : ''
        }`}
    </Typography>
  );

  const renderBody = () => (
    <Stack
      sx={[
        {
          p: 1.5,
          minWidth: 48,
          maxWidth: 320,
          borderRadius: 1,
          typography: 'body2',
          bgcolor: 'background.neutral',
          ...(me && { color: 'grey.800', bgcolor: 'primary.lighter' }),
          ...(hasImage && { p: 0, bgcolor: 'transparent' }),
        },
        // EL PRODUCTO COMPARTIDO, OSCURO EN EL TEMA OSCURO. El globo propio es
        // celeste en los dos temas, y con la tarjeta ya oscura dentro quedaba un
        // recuadro claro alrededor de una tarjeta oscura.
        !!message.metadata?.sharedProduct && {
          // Y MAS ESTRECHO EN EL CELULAR. Con los 320px del globo, la imagen
          // cuadrada de la tarjeta se estiraba a lo alto casi como la pantalla:
          // un solo producto compartido tapaba la conversacion entera. Misma
          // medida que las fotos enviadas, que ya se acotan por ancho de pantalla.
          maxWidth: { xs: 'min(64vw, 230px)', sm: 320 },
        },
        // LA FOTO DEL CUMPLEAÑERO, del ancho de las fotos enviadas: a 320px una foto
        // vertical ocupaba la pantalla entera en el celular.
        !!message.metadata?.cumpleanosSistema && { maxWidth: { xs: 'min(70vw, 260px)', sm: 280 } },
        !!message.metadata?.reporteProblema && { maxWidth: { xs: 'min(78vw, 340px)', sm: 420 } },
        !!message.metadata?.sharedProduct &&
          ((theme) =>
            theme.applyStyles('dark', { color: 'text.primary', bgcolor: 'background.neutral' })),
      ]}
    >
      {isDeleted ? (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <Typography
            component="span"
            variant="body2"
            sx={{ color: 'text.disabled', fontStyle: 'italic' }}
          >
            Mensaje eliminado
          </Typography>

          {me && (
            <UnderlineLink
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onRestore?.(message);
              }}
              sx={{
                typography: 'caption',
                fontWeight: 700,
                color: 'primary.main',
              }}
            >
              Deshacer
            </UnderlineLink>
          )}
        </Box>
      ) : hasImage ? (
        <Box
          sx={{
            gap: 0.5,
            width: imageUrls.length > 1 ? 260 : 220,
            maxWidth: imageUrls.length > 1 ? 'min(70vw, 260px)' : 'min(64vw, 220px)',
            display: 'grid',
            gridTemplateColumns: imageUrls.length > 1 ? 'repeat(2, 1fr)' : '1fr',
          }}
        >
          {imageUrls.map((imageUrl, index) => (
            <Box
              key={`${imageUrl}-${index}`}
              component="img"
              loading="lazy"
              decoding="async"
              alt="Adjunto"
              src={imageUrl}
              onClick={() => onOpenLightbox(imageUrl)}
              sx={{
                width: 1,
                height: imageUrls.length > 1 ? 112 : 165,
                display: 'block',
                borderRadius: 1.5,
                cursor: 'pointer',
                objectFit: 'cover',
                '&:hover': { opacity: 0.9 },
              }}
            />
          ))}
        </Box>
      ) : message.contentType === 'file' && attachment ? (
        <Box
          component="a"
          href={attachment.url || attachment.downloadURL}
          target="_blank"
          rel="noreferrer"
          sx={{
            gap: 1,
            minWidth: 220,
            display: 'flex',
            color: 'inherit',
            alignItems: 'center',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {/* EL ICONO DEL TIPO QUE ES. Todos los documentos salian con la misma
              hoja gris: un PDF, un ZIP y una hoja de calculo se distinguian
              leyendo la letra pequeña. Es el mismo juego de iconos del panel de
              adjuntos, asi que el archivo se ve igual en los dos sitios. */}
          <FileThumbnail
            file={formatoDelAdjunto(attachment)}
            slotProps={{ icon: { sx: { width: 24, height: 24 } } }}
            sx={{ width: 32, height: 32 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap variant="body2" sx={{ fontWeight: 700 }}>
              {attachment.nombre || body}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {/* Y lo que pesa, detras del tipo: antes habia que descargarlo
                  para saber si eran 80 kB o 40 MB. */}
              {[attachment.tipo || 'Archivo', pesoDeArchivo(attachment.tamano ?? attachment.size)]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
          {message.replyTo && (
            <Box
              component="button"
              type="button"
              onClick={() => onJumpToMessage?.(message.replyTo.id)}
              sx={{
                width: 1,
                mb: 1,
                px: 1,
                py: 0.75,
                border: 0,
                borderRadius: 0.75,
                textAlign: 'left',
                cursor: 'pointer',
                color: 'text.secondary',
                bgcolor: 'background.paper',
                maxWidth: 1,
                overflow: 'hidden',
                borderLeft: (theme) => `3px solid ${theme.vars.palette.primary.main}`,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {message.replyTo.body}
              </Typography>
            </Box>
          )}

          {message.metadata?.reporteProblema ? (
            <Box
              sx={[
                {
                  p: 1.25,
                  borderRadius: 1.25,
                  border: (theme) => `1px solid ${theme.vars.palette.error.main}`,
                  bgcolor: 'error.lighter',
                },
                (theme) => theme.applyStyles('dark', {
                  bgcolor: '#701C35',
                  borderColor: '#B05A70',
                  color: '#fff',
                  '& .MuiTypography-root.MuiTypography-caption': {
                    color: 'rgba(255,255,255,0.78)',
                  },
                }),
              ]}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Avatar
                  src={message.metadata.reporteProblema.fotoUrl}
                  alt={message.metadata.reporteProblema.nombre}
                  sx={{ width: 34, height: 34 }}
                >
                  <Iconify icon="solar:bug-bold" width={18} />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {message.metadata.reporteProblema.nombre}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(message.metadata.reporteProblema.fecha).toLocaleString('es-DO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Typography>
                </Box>
              </Stack>
              <Typography component="div" variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {message.metadata.reporteProblema.mensaje}
              </Typography>
              {message.metadata.reporteProblema.ruta && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Pantalla: {message.metadata.reporteProblema.ruta}
                </Typography>
              )}
            </Box>
          ) : message.metadata?.cumpleanosSistema ? (
            <TarjetaDeCumpleanos
              cumpleanos={message.metadata.cumpleanosSistema}
              texto={body}
              onOpenLightbox={onOpenLightbox}
            />
          ) : message.metadata?.sharedProduct ? (
            <>
              {/* El texto del mensaje encima de la tarjeta, sin la URL —esa
                  es la tarjeta— ni el nombre, que ya va dentro. Sin el, la
                  tarjeta llegaba sola y no se sabia que era un envio. */}
              <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                {String(body || '')
                  .split('\n')[0]
                  .replace(`: ${message.metadata.sharedProduct.name}`, '')
                  .trim() || 'Te comparto este producto de la Tienda Virtual'}
              </Typography>

              <TarjetaProductoCompartido producto={message.metadata.sharedProduct} />
            </>
          ) : (
            <Typography component="span" variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {renderMessageBodyText(body, message.metadata, participants)}
            </Typography>
          )}
        </>
      )}
    </Stack>
  );

  const renderReactions = () =>
    !isDeleted &&
    !!reactionGroups.length && (
      <Box
        component="span"
        sx={{
          gap: 0.5,
          bottom: -14,
          right: me ? 22 : -10,
          zIndex: 1,
          display: 'flex',
          position: 'absolute',
        }}
      >
        {reactionGroups.map((group) => (
          <Tooltip
            arrow
            key={group.emoji}
            placement="top"
            enterTouchDelay={0}
            title={
              <Box sx={{ py: 0.25 }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                  {`${group.emoji} ${group.count} ${group.count === 1 ? 'reacción' : 'reacciones'}`}
                </Typography>
                {group.names.map((name, index) => (
                  <Typography
                    key={`${group.memberIds[index]}-${name}`}
                    variant="caption"
                    sx={{ display: 'block' }}
                  >
                    {name}
                  </Typography>
                ))}
              </Box>
            }
          >
            <Box
              component="button"
              type="button"
              aria-label={`${group.emoji}: ${group.names.join(', ')}`}
              aria-pressed={selectedReactionEmoji === group.emoji}
              onClick={() => handleSelectEmoji(group.emoji)}
              sx={{
                gap: 0.4,
                px: 0.9,
                py: 0.35,
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 10,
                fontSize: 18,
                lineHeight: 1,
                cursor: 'pointer',
                border: (theme) =>
                  `1px solid ${
                    selectedReactionEmoji === group.emoji
                      ? theme.vars.palette.primary.main
                      : theme.vars.palette.divider
                  }`,
                bgcolor:
                  selectedReactionEmoji === group.emoji ? 'action.selected' : 'background.paper',
                boxShadow: 1,
                '&:focus-visible': {
                  outline: (theme) => `2px solid ${theme.vars.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box component="span">{group.emoji}</Box>
              {group.count > 1 && (
                <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
                  {group.count}
                </Typography>
              )}
            </Box>
          </Tooltip>
        ))}
      </Box>
    );

  const renderActions = () => (
    <>
      <Box
        className="message-actions"
        sx={(theme) => ({
          pt: 0.5,
          left: 0,
          opacity: 0,
          top: '100%',
          display: 'flex',
          position: 'absolute',
          transition: theme.transitions.create(['opacity'], {
            duration: theme.transitions.duration.shorter,
          }),
          ...(emojiPickerOpen && { opacity: 1 }),
          ...(me && { right: 0, left: 'unset' }),
        })}
      >
        {/* Sin `onReply` no hay a quien responder: el chat de Sistema no admite respuestas. */}
        {onReply && (
          <IconButton
            size="small"
            disabled={isDeleted}
            aria-label="Responder mensaje"
            onClick={() => onReply(message)}
          >
            <Iconify icon="solar:reply-bold" width={16} />
          </IconButton>
        )}

        <IconButton
          size="small"
          disabled={isDeleted}
          aria-label="Agregar reacción"
          onClick={(event) => {
            setShowAllReactionEmojis(false);
            setEmojiAnchorEl(event.currentTarget);
          }}
        >
          <Iconify icon="eva:smiling-face-fill" width={16} />
        </IconButton>

        {me && (
          <IconButton
            size="small"
            disabled={isDeleted}
            aria-label="Editar mensaje"
            onClick={() => onEdit?.(message)}
          >
            <Iconify icon="solar:pen-bold" width={16} />
          </IconButton>
        )}

        {me && canDeleteMessage && (
          <IconButton
            size="small"
            disabled={isDeleted}
            aria-label="Eliminar mensaje"
            onClick={() => onDelete?.(message)}
          >
            <Iconify icon="solar:trash-bin-trash-bold" width={16} />
          </IconButton>
        )}
      </Box>

      <Popover
        open={emojiPickerOpen}
        anchorEl={emojiAnchorEl}
        onClose={() => setEmojiAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: me ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: me ? 'right' : 'left' }}
        slotProps={{ paper: { sx: { p: 0.75, borderRadius: 1.5 } } }}
      >
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {EMOJI_OPTIONS.map((emoji, index) => (
            <IconButton
              key={`${emoji}-${index}`}
              size="small"
              aria-label={`Reaccionar con ${emoji}`}
              aria-pressed={selectedReactionEmoji === emoji}
              onClick={() => {
                handleSelectEmoji(emoji);
              }}
              sx={{
                fontSize: 24,
                bgcolor: selectedReactionEmoji === emoji ? 'action.selected' : 'transparent',
                boxShadow: (theme) =>
                  selectedReactionEmoji === emoji
                    ? `0 0 0 1px ${theme.vars.palette.primary.main}`
                    : 'none',
                '&:hover': {
                  bgcolor: selectedReactionEmoji === emoji ? 'action.selected' : 'action.hover',
                },
              }}
            >
              {emoji}
            </IconButton>
          ))}

          <IconButton
            size="small"
            aria-label={showAllReactionEmojis ? 'Ocultar más emojis' : 'Mostrar más emojis'}
            aria-expanded={showAllReactionEmojis}
            onClick={() => setShowAllReactionEmojis((value) => !value)}
            sx={{
              width: 36,
              height: 36,
              border: (theme) => `1px dashed ${theme.vars.palette.divider}`,
            }}
          >
            <Iconify icon="mingcute:add-line" width={18} />
          </IconButton>
        </Box>

        {showAllReactionEmojis && (
          <PanelDeEmojis
            ancho={340}
            tamano={42}
            activo={showAllReactionEmojis}
            seleccionado={selectedReactionEmoji}
            onSelectEmoji={handleSelectEmoji}
          />
        )}
      </Popover>
    </>
  );

  const renderDeliveryStatus = () =>
    isSent && (
      <Iconify
        icon={deliveryStatus === 'enviado' ? 'eva:done-fill' : 'eva:done-all-fill'}
        width={16}
        aria-label={
          deliveryStatus === 'visto'
            ? 'Mensaje leído'
            : deliveryStatus === 'entregado'
              ? 'Mensaje entregado'
              : 'Mensaje enviado'
        }
        sx={{
          ml: 0.75,
          alignSelf: 'flex-end',
          lineHeight: 1,
          color: deliveryStatus === 'visto' ? '#00A76F' : 'text.disabled',
        }}
      />
    );

  if (!message.body) {
    return null;
  }

  // Los cambios del grupo los escribe el sistema, no una persona. Se muestran
  // como avisos neutrales: sin avatar, burbuja, reacciones ni estado de entrega.
  if (isSystemMessage) {
    return (
      <Box
        id={`chat-message-${message.id}`}
        sx={{
          mb: 3,
          px: 2,
          width: 1,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ maxWidth: 520, textAlign: 'center' }}>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}
          >
            {renderMessageBodyText(body, message.metadata, participants)}
          </Typography>

          <Typography
            component="time"
            dateTime={createdAt}
            variant="caption"
            sx={{ mt: 0.25, display: 'block', color: 'text.disabled', fontStyle: 'italic' }}
          >
            {formatChatTime(createdAt)}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      id={`chat-message-${message.id}`}
      sx={{
        mb: 5,
        display: 'flex',
        justifyContent: me ? 'flex-end' : 'unset',
        borderRadius: 1.5,
        transition: (theme) =>
          theme.transitions.create(['background-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),
        ...(highlighted && {
          bgcolor: 'action.hover',
          boxShadow: (theme) => `0 0 0 2px ${theme.vars.palette.primary.main}`,
        }),
      }}
    >
      {!me && <Avatar alt={firstName} src={avatarUrl} sx={{ width: 32, height: 32, mr: 2 }} slotProps={{ img: { loading: 'lazy', decoding: 'async' } }} />}

      <Stack alignItems={me ? 'flex-end' : 'flex-start'}>
        {renderInfo()}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            '&:hover': { '& .message-actions': { opacity: 1 } },
          }}
        >
          {renderBody()}
          {renderReactions()}
          {renderDeliveryStatus()}
          {renderActions()}
        </Box>
      </Stack>
    </Box>
  );
}
