import { useRef, useState, useCallback } from 'react';
import { uuidv4, varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import Checkbox from '@mui/material/Checkbox';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import InputBase from '@mui/material/InputBase';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fShortenNumber } from 'src/utils/format-number';
import { fDate, fTime, fTimestamp } from 'src/utils/format-time';

import { CONFIG } from 'src/global-config';
import { crearNotificacionReportePublicacion } from 'src/services/notification-service';

import { Image } from 'src/components/image';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { SvgColor } from 'src/components/svg-color';

import { useMockedUser } from 'src/auth/hooks';

import { ProfileEmojiPicker } from './profile-emoji-picker';

// ----------------------------------------------------------------------

const getProfileHref = (person) => `/dashboard/user/${person?.id || 'profile'}`;
const LOCAL_REPORT_NOTIFICATIONS_KEY = 'dashboard_post_report_notifications';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HASHTAG_REGEX = /(#[A-Za-zÀ-ÿ0-9_]+)/g;
const HASHTAG_EXACT_REGEX = /^#[A-Za-zÀ-ÿ0-9_]+$/;

const formatPostCreatedAt = (input) => {
  const timestamp = fTimestamp(input);

  if (!timestamp || timestamp === 'Invalid') {
    return fDate(input);
  }

  const diffMs = Date.now() - timestamp;

  if (diffMs >= 0 && diffMs < ONE_DAY_MS) {
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

    const hours = Math.floor(minutes / 60);
    return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }

  return `${fDate(input, 'DD MMM YYYY').toLowerCase()} ${fTime(input)}`;
};

const saveLocalReportNotification = ({ post, reason, user, url }) => {
  if (typeof window === 'undefined') return;

  const createdAt = new Date().toISOString();
  const displayName = user?.displayName || user?.nombre || user?.email || 'Usuario';
  const notification = {
    id: `local_publicacion_reportada_${post.id}_${Date.now()}`,
    type: 'mail',
    tipoNotificacion: 'publicacion_reportada',
    category: 'Publicaciones',
    estado: 'no_leida',
    isUnRead: true,
    createdAt,
    ruta: url,
    entidadId: post.id,
    avatarUrl: user?.photoURL || null,
    title: `<p><strong>${displayName}</strong> reporto una publicacion</p>`,
    metadatos: {
      idPublicacion: post.id,
      razon: reason,
      mensajePublicacion: post.message || '',
      urlPublicacion: url,
      local: true,
    },
  };
  const stored = JSON.parse(window.localStorage.getItem(LOCAL_REPORT_NOTIFICATIONS_KEY) || '[]');

  window.localStorage.setItem(
    LOCAL_REPORT_NOTIFICATIONS_KEY,
    JSON.stringify([notification, ...stored].slice(0, 20))
  );
  window.dispatchEvent(new Event('notificaciones:actualizar'));
};

const renderTextWithHashtags = (text = '') =>
  String(text)
    .split(HASHTAG_REGEX)
    .map((part, index) => {
      if (!HASHTAG_EXACT_REGEX.test(part)) return part;

      const tag = part.slice(1);

      return (
        <Link
          key={`${part}-${index}`}
          href={`${paths.dashboard.principal}?hashtag=${encodeURIComponent(tag)}`}
          color="primary"
          underline="hover"
          sx={{ fontWeight: 700 }}
        >
          {part}
        </Link>
      );
    });

export function ProfilePostItem({ post, user: currentUser }) {
  const router = useRouter();

  const { user: mockedUser } = useMockedUser();
  const user = currentUser || mockedUser;

  const fileRef = useRef(null);
  const commentRef = useRef(null);

  const [message, setMessage] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [liked, setLiked] = useState(Boolean(post.isLikedByMe));
  const [commentImage, setCommentImage] = useState(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [emojiCategory, setEmojiCategory] = useState('Caras');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [shareAnchorEl, setShareAnchorEl] = useState(null);
  const [reported, setReported] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportSending, setReportSending] = useState(false);

  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const postMenuOpen = Boolean(menuAnchorEl);
  const shareMenuOpen = Boolean(shareAnchorEl);
  const mediaItems = post.mediaItems?.length ? post.mediaItems : post.media ? [post.media] : [];
  const displayedLikes = liked
    ? [{ name: user?.displayName, avatarUrl: user?.photoURL }, ...(post.personLikes || [])]
    : post.personLikes || [];

  const handleChangeMessage = useCallback((event) => {
    setMessage(event.target.value);
  }, []);

  const handleInsertEmoji = useCallback((emoji) => {
    setMessage((currentMessage) => `${currentMessage}${emoji}`);
  }, []);

  const handleAttach = useCallback(() => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  }, []);

  const handleClickComment = useCallback(() => {
    if (commentRef.current) {
      commentRef.current.focus();
    }
  }, []);

  const handleUploadCommentImage = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file || !String(file.type || '').startsWith('image/')) return;

      if (commentImage?.previewUrl) {
        URL.revokeObjectURL(commentImage.previewUrl);
      }

      setCommentImage({
        id: `comment-image-${file.name}-${file.size}-${file.lastModified}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    },
    [commentImage]
  );

  const handleRemoveCommentImage = useCallback(() => {
    if (commentImage?.previewUrl) {
      URL.revokeObjectURL(commentImage.previewUrl);
    }

    setCommentImage(null);
  }, [commentImage]);

  const handleSubmitComment = useCallback(() => {
    const nextMessage = message.trim();

    if (!nextMessage && !commentImage) return;

    setComments((currentComments) => [
      ...currentComments,
      {
        id: uuidv4(),
        author: {
          id: user?.id || user?.uid || 'usuario-actual',
          avatarUrl: user?.photoURL,
          name: user?.displayName || 'Usuario',
        },
        createdAt: new Date().toISOString(),
        message: nextMessage,
        imageUrl: commentImage?.previewUrl || '',
      },
    ]);
    setMessage('');
    setCommentImage(null);
  }, [commentImage, message, user]);

  const getPostShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return `${paths.dashboard.principal}#post-${post.id}`;

    return `${window.location.origin}${paths.dashboard.principal}/#post-${post.id}`;
  }, [post.id]);

  const getShareText = useCallback(() => post.message || 'Publicacion compartida', [post.message]);

  const handleHidePost = useCallback(() => {
    setMenuAnchorEl(null);
    setHidden(true);
  }, []);

  const handleUndoHidePost = useCallback(() => {
    setHidden(false);
  }, []);

  const handleOpenReportDialog = useCallback(() => {
    setMenuAnchorEl(null);
    setReportDialogOpen(true);
  }, []);

  const handleCloseReportDialog = useCallback(() => {
    if (reportSending) return;

    setReportDialogOpen(false);
  }, [reportSending]);

  const handleSubmitReport = useCallback(async () => {
    const nextReason = reportReason.trim();

    if (!nextReason) {
      toast.error('Escribe la razon del reporte.');
      return;
    }

    setReportSending(true);

    const shareUrl = getPostShareUrl();

    try {
      const notification = await crearNotificacionReportePublicacion({
        publicacion: {
          idPublicacion: post.id,
          mensaje: post.message,
          url: shareUrl,
        },
        razon: nextReason,
        usuario: user,
      });

      if (!notification) {
        saveLocalReportNotification({ post, reason: nextReason, user, url: shareUrl });
      }
    } catch (error) {
      console.error(error);
      saveLocalReportNotification({ post, reason: nextReason, user, url: shareUrl });
    } finally {
      setReported(true);
      setReportReason('');
      setReportDialogOpen(false);
      setReportSending(false);
      toast.success('Reporte enviado al administrador.');
    }
  }, [getPostShareUrl, post, reportReason, user]);

  const handleCopyLink = useCallback(async () => {
    const shareUrl = getPostShareUrl();

    setShareAnchorEl(null);

    try {
      await navigator.clipboard?.writeText(shareUrl);
      toast.success('Enlace copiado.');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo copiar el enlace.');
    }
  }, [getPostShareUrl]);

  const handleShareToChat = useCallback(() => {
    const shareUrl = getPostShareUrl();
    const shareText = `${getShareText()}\n${shareUrl}`;

    setShareAnchorEl(null);
    router.push(`${paths.dashboard.chat}?share=${encodeURIComponent(shareText)}`);
  }, [getPostShareUrl, getShareText, router]);

  const handleNativeShare = useCallback(async () => {
    const shareUrl = getPostShareUrl();

    setShareAnchorEl(null);

    if (navigator.share) {
      try {
        await navigator.share({
          title: user?.displayName || 'Publicacion',
          text: getShareText(),
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error(error);
        }
      }
    }

    window.location.href = `mailto:?subject=${encodeURIComponent('Publicacion compartida')}&body=${encodeURIComponent(
      `${getShareText()}\n${shareUrl}`
    )}`;
  }, [getPostShareUrl, getShareText, user?.displayName]);

  const renderHead = () => (
    <>
      <CardHeader
        disableTypography
        avatar={
          <Link href={getProfileHref(user)} color="inherit" underline="none">
            <Avatar src={user?.photoURL} alt={user?.displayName}>
              {user?.displayName?.charAt(0).toUpperCase()}
            </Avatar>
          </Link>
        }
        title={
          <Link href={getProfileHref(user)} color="inherit" variant="subtitle1">
            {user?.displayName}
          </Link>
        }
        subheader={
          <Box sx={{ color: 'text.disabled', typography: 'caption', mt: 0.5 }}>
            {formatPostCreatedAt(post.createdAt)}
            {reported && ' · Reportada'}
          </Box>
        }
        action={
          <IconButton onClick={(event) => setMenuAnchorEl(event.currentTarget)}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        }
      />

      <Popover
        open={postMenuOpen}
        anchorEl={menuAnchorEl}
        onClose={() => setMenuAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList sx={{ minWidth: 210 }}>
          <MenuItem onClick={handleHidePost}>
            <Iconify icon="solar:eye-closed-bold" />
            Ocultar anuncio
          </MenuItem>

          <MenuItem onClick={handleOpenReportDialog} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:flag-bold" />
            Reportar anuncio
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );

  const renderCommentList = () => (
    <Stack spacing={1.5} sx={{ px: 3, pb: 2 }}>
      {comments.map((comment) => (
        <Box key={comment.id} sx={{ gap: 2, display: 'flex' }}>
          <Avatar alt={comment.author.name} src={comment.author.avatarUrl} />

          <Paper sx={{ p: 1.5, flexGrow: 1, bgcolor: 'background.neutral' }}>
            <Box
              sx={{
                mb: 0.5,
                display: 'flex',
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              <Link href={getProfileHref(comment.author)} color="inherit" variant="subtitle2">
                {comment.author.name}
              </Link>

              <Box sx={{ typography: 'caption', color: 'text.disabled' }}>
                {formatPostCreatedAt(comment.createdAt)}
              </Box>
            </Box>

            <Box sx={{ typography: 'body2', color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
              {renderTextWithHashtags(comment.message)}
            </Box>

            {comment.imageUrl && (
              <Box
                component="img"
                src={comment.imageUrl}
                alt={comment.message || 'Comentario'}
                sx={{
                  mt: 1,
                  width: 160,
                  maxWidth: 1,
                  borderRadius: 1,
                  display: 'block',
                }}
              />
            )}
          </Paper>
        </Box>
      ))}
    </Stack>
  );

  const renderInput = () => (
    <Stack spacing={1} sx={[(theme) => ({ px: 3, pb: 3, display: 'flex', alignItems: 'stretch' })]}>
      {commentImage && (
        <Box
          sx={{
            gap: 1,
            p: 0.75,
            width: 180,
            display: 'flex',
            borderRadius: 1,
            alignItems: 'center',
            bgcolor: 'background.neutral',
          }}
        >
          <Box
            component="img"
            src={commentImage.previewUrl}
            alt={commentImage.file.name}
            sx={{ width: 42, height: 42, borderRadius: 1, objectFit: 'cover' }}
          />
          <Typography noWrap variant="caption" sx={{ minWidth: 0, flexGrow: 1 }}>
            {commentImage.file.name}
          </Typography>
          <IconButton size="small" onClick={handleRemoveCommentImage}>
            <Iconify icon="mingcute:close-line" width={16} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
        <Avatar src={user?.photoURL} alt={user?.displayName}>
          {user?.displayName?.charAt(0).toUpperCase()}
        </Avatar>

        <InputBase
          fullWidth
          value={message}
          inputRef={commentRef}
          placeholder="Escribe un comentario..."
          onChange={handleChangeMessage}
          onKeyUp={(event) => {
            if (event.key === 'Enter') {
              handleSubmitComment();
            }
          }}
          endAdornment={
            <InputAdornment position="end" sx={{ mr: 1 }}>
              <IconButton size="small" onClick={handleAttach}>
                <Iconify icon="solar:gallery-add-bold" />
              </IconButton>

              <IconButton size="small" onClick={(event) => setEmojiAnchorEl(event.currentTarget)}>
                <Iconify icon="eva:smiling-face-fill" />
              </IconButton>

              <IconButton
                size="small"
                color="primary"
                disabled={!message.trim() && !commentImage}
                onClick={handleSubmitComment}
              >
                <Iconify icon="solar:plain-bold" />
              </IconButton>
            </InputAdornment>
          }
          inputProps={{
            id: `comment-${post.id}-input`,
            'aria-label': `Comentario ${post.id}`,
          }}
          sx={[
            (theme) => ({
              pl: 1.5,
              minHeight: 40,
              borderRadius: 1,
              border: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.32)}`,
            }),
          ]}
        />
      </Box>

      <ProfileEmojiPicker
        open={emojiPickerOpen}
        anchorEl={emojiAnchorEl}
        emojiCategory={emojiCategory}
        onClose={() => setEmojiAnchorEl(null)}
        onChangeCategory={setEmojiCategory}
        onSelectEmoji={handleInsertEmoji}
      />

      <input
        type="file"
        accept="image/*"
        ref={fileRef}
        style={{ display: 'none' }}
        onChange={handleUploadCommentImage}
      />
    </Stack>
  );

  const renderMedia = () => {
    if (!mediaItems.length) return null;

    if (mediaItems.length === 1) {
      return (
        <Box sx={{ p: 1 }}>
          <Image
            alt={post.message || post.media}
            src={mediaItems[0]}
            ratio="16/9"
            sx={{ borderRadius: 1.5 }}
          />
        </Box>
      );
    }

    return (
      <Box
        sx={[
          {
            gap: 1,
            p: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          },
        ]}
      >
        {mediaItems.map((media, index) => (
          <Image
            key={`${media}-${index}`}
            alt={`${post.message || 'Publicacion'} ${index + 1}`}
            src={media}
            ratio="1/1"
            sx={{ borderRadius: 1.5 }}
          />
        ))}
      </Box>
    );
  };

  const renderActions = () => (
    <>
      <Box
        sx={[(theme) => ({ display: 'flex', alignItems: 'center', p: theme.spacing(2, 3, 3, 3) })]}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={liked}
              color="error"
              icon={<Iconify icon="solar:heart-bold" />}
              checkedIcon={<Iconify icon="solar:heart-bold" />}
              onChange={(event) => setLiked(event.target.checked)}
              slotProps={{
                input: {
                  id: `favorite-${post.id}-checkbox`,
                  'aria-label': `Favorito ${post.id}`,
                },
              }}
            />
          }
          label={fShortenNumber(displayedLikes.length)}
          sx={{ mr: 1 }}
        />

        {!!displayedLikes.length && (
          <AvatarGroup
            sx={{
              [`& .${avatarGroupClasses.avatar}`]: {
                width: 32,
                height: 32,
              },
            }}
          >
            {displayedLikes.map((person, index) => (
              <Avatar key={`${person.name}-${index}`} alt={person.name} src={person.avatarUrl} />
            ))}
          </AvatarGroup>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <IconButton onClick={handleClickComment}>
          <Iconify icon="solar:chat-round-dots-bold" />
        </IconButton>

        <IconButton onClick={(event) => setShareAnchorEl(event.currentTarget)}>
          <Iconify icon="solar:share-bold" />
        </IconButton>
      </Box>

      <Popover
        open={shareMenuOpen}
        anchorEl={shareAnchorEl}
        onClose={() => setShareAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList
          sx={{
            py: 0.75,
            minWidth: 240,
            '& .MuiMenuItem-root': {
              gap: 1.5,
              py: 1.25,
              px: 2,
            },
            '& svg': {
              color: 'text.secondary',
            },
          }}
        >
          <MenuItem onClick={handleCopyLink}>
            <Iconify icon="solar:copy-bold" />
            Copiar enlace
          </MenuItem>

          <MenuItem onClick={handleShareToChat}>
            <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/ic-chat.svg`} />
            Compartir en chats
          </MenuItem>

          <MenuItem onClick={handleNativeShare}>
            <Iconify icon="solar:export-bold" />
            Enviar con otra app
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );

  const renderHiddenPost = () => (
    <Card
      id={`post-${post.id}`}
      sx={(theme) => ({
        p: 2,
        border: `dashed 1px ${theme.vars.palette.divider}`,
        bgcolor: 'background.neutral',
      })}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Iconify icon="solar:eye-closed-bold" sx={{ color: 'text.secondary' }} />

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2">Anuncio oculto</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Ya no estas viendo esta publicacion.
          </Typography>
        </Box>

        <Button size="small" variant="outlined" onClick={handleUndoHidePost}>
          Deshacer
        </Button>
      </Stack>
    </Card>
  );

  const renderReportDialog = () => (
    <Dialog fullWidth maxWidth="xs" open={reportDialogOpen} onClose={handleCloseReportDialog}>
      <DialogTitle>Reportar anuncio</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Escribe la razon del reporte. Se enviara una notificacion a los administradores.
        </Typography>

        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={4}
          label="Razon"
          value={reportReason}
          disabled={reportSending}
          onChange={(event) => setReportReason(event.target.value)}
        />
      </DialogContent>

      <DialogActions>
        <Button color="inherit" disabled={reportSending} onClick={handleCloseReportDialog}>
          Cancelar
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={!reportReason.trim() || reportSending}
          onClick={handleSubmitReport}
        >
          Enviar reporte
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {hidden ? (
        renderHiddenPost()
      ) : (
        <Card id={`post-${post.id}`}>
          {renderHead()}

          {post.message && (
            <Typography
              variant="body2"
              sx={[(theme) => ({ p: theme.spacing(3, 3, 2, 3), whiteSpace: 'pre-wrap' })]}
            >
              {renderTextWithHashtags(post.message)}
            </Typography>
          )}

          {renderMedia()}

          {renderActions()}
          {!!comments.length && renderCommentList()}
          {renderInput()}
        </Card>
      )}

      {renderReportDialog()}
    </>
  );
}
