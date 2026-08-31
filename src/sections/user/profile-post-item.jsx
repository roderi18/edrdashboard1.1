import dayjs from 'dayjs';
import { uuidv4, varAlpha } from 'minimal-shared/utils';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
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
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fShortenNumber } from 'src/utils/format-number';
import { fDate, fTime, fTimestamp } from 'src/utils/format-time';
import {
  PRINCIPAL_LIMITS,
  PRINCIPAL_IMAGE_ACCEPT,
  getPrincipalImageValidationError,
} from 'src/utils/principal-content';

import { CONFIG } from 'src/global-config';
import { crearNotificacionReportePublicacion } from 'src/services/notification-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { SvgColor } from 'src/components/svg-color';

import { useMockedUser } from 'src/auth/hooks';

import { ProfileEmojiPicker } from './profile-emoji-picker';

// ----------------------------------------------------------------------

const getProfileHref = (person = {}) => {
  const idMiembros = person.idMiembros || person.autorIdMiembros || person.id;

  return idMiembros
    ? `${paths.dashboard.user.root}?idMiembros=${encodeURIComponent(idMiembros)}`
    : paths.dashboard.user.root;
};
const LOCAL_REPORT_NOTIFICATIONS_KEY = 'dashboard_post_report_notifications';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const COMMENTS_PAGE_SIZE = 6;
const MEDIA_PREVIEW_LIMIT = 4;
const REMINDER_MENU_OPEN_DELAY_MS = 300;
const HASHTAG_REGEX = /(#[A-Za-zÀ-ÿ0-9_]+)/g;
const HASHTAG_EXACT_REGEX = /^#[A-Za-zÀ-ÿ0-9_]+$/;
const COMMENT_FILTERS = [
  {
    value: 'relevantes',
    label: 'Más relevantes',
    description: 'Se muestran los comentarios con más respuestas e interacciones en primer lugar.',
  },
  {
    value: 'recientes',
    label: 'Más recientes',
    description:
      'Se muestran todos los comentarios. Los comentarios más recientes aparecerán en primer lugar.',
  },
  {
    value: 'todos',
    label: 'Todos los comentarios',
    description: 'Se muestran todos los comentarios, incluido el posible spam.',
  },
];

const createPendingComment = ({
  message,
  image,
  user,
  idComentarioPadre = '',
  replyToName = '',
}) => ({
  id: uuidv4(),
  idComentarioPadre,
  replyToName,
  uidAutor: user?.uid || '',
  autorIdMiembros: user?.idMiembros || null,
  codigoMiembroAutor: user?.codigoMiembro || '',
  correoAutor: user?.correo || user?.email || '',
  pending: true,
  author: {
    id: user?.idMiembros || user?.id || user?.uid || 'usuario-actual',
    uid: user?.uid || '',
    idMiembros: user?.idMiembros,
    codigoMiembro: user?.codigoMiembro,
    correo: user?.correo || user?.email || '',
    avatarUrl: user?.photoURL,
    name: user?.displayName || user?.nombre || 'Usuario',
  },
  createdAt: new Date().toISOString(),
  message,
  imageUrl: image?.previewUrl || '',
});

const getCommentTime = (comment = {}) => fTimestamp(comment.createdAt) || 0;

const getCommentRelevanceScore = (comment = {}) =>
  Number(comment.replies?.length || 0) + (comment.imageUrl ? 1 : 0);

const getCommentsCount = (items = []) =>
  items.reduce((total, comment) => total + 1 + Number(comment.replies?.length || 0), 0);

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

export function ProfilePostItem({
  post,
  user: currentUser,
  onAddComment,
  onToggleLike,
  onHidePost,
  onUndoHidePost,
  onSharePost,
  onReportPost,
  onDeletePost,
  onRememberPost,
}) {
  const router = useRouter();

  const { user: mockedUser } = useMockedUser();
  const user = currentUser || mockedUser;
  const author = post.author || user;

  const fileRef = useRef(null);
  const commentRef = useRef(null);
  const commentsScrollRef = useRef(null);
  const commentsLoaderRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const reminderOpenTimeoutRef = useRef(null);
  const reminderCloseTimeoutRef = useRef(null);
  const reminderItemRef = useRef(null);
  const reminderMenuPaperRef = useRef(null);
  const reminderPointerRef = useRef({ x: 0, y: 0 });

  const [message, setMessage] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [liked, setLiked] = useState(Boolean(post.isLikedByMe));
  const [likeSending, setLikeSending] = useState(false);
  const [commentImage, setCommentImage] = useState(null);
  const [commentSending, setCommentSending] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [emojiCategory, setEmojiCategory] = useState('Caras');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [shareAnchorEl, setShareAnchorEl] = useState(null);
  const [commentFilterAnchorEl, setCommentFilterAnchorEl] = useState(null);
  const [commentFilter, setCommentFilter] = useState('relevantes');
  const [reminderAnchorEl, setReminderAnchorEl] = useState(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState(dayjs().add(1, 'day'));
  const [reminderChannels, setReminderChannels] = useState({ chat: false, correo: false });
  const [reminderSending, setReminderSending] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportSending, setReportSending] = useState(false);

  // La foto suelta no trae medidas: hasta que no llega, el navegador no sabe
  // cuanto va a ocupar y la publicacion mide casi cero de alto. Con veinte
  // publicaciones apiladas en unos pocos pixeles, TODAS caen dentro del margen
  // de carga del navegador y se descargan de golpe, aunque nadie haya deslizado.
  // Se le guarda el sitio hasta que la imagen se mide sola.
  const [fotoSueltaMedida, setFotoSueltaMedida] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState('');
  const [visibleRootCommentsCount, setVisibleRootCommentsCount] = useState(COMMENTS_PAGE_SIZE);

  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const postMenuOpen = Boolean(menuAnchorEl);
  const shareMenuOpen = Boolean(shareAnchorEl);
  const commentFilterMenuOpen = Boolean(commentFilterAnchorEl);
  const reminderMenuOpen = Boolean(reminderAnchorEl);
  const mediaItems = useMemo(
    () => (post.mediaItems?.length ? post.mediaItems : post.media ? [post.media] : []),
    [post.media, post.mediaItems]
  );
  const visibleMediaItems = useMemo(() => mediaItems.slice(0, MEDIA_PREVIEW_LIMIT), [mediaItems]);
  const hiddenMediaCount = Math.max(mediaItems.length - MEDIA_PREVIEW_LIMIT, 0);
  const selectedMedia = mediaItems[selectedMediaIndex] || mediaItems[0] || '';
  const hasMultipleMedia = mediaItems.length > 1;
  const commentsCount = getCommentsCount(comments);
  const currentCommentFilter =
    COMMENT_FILTERS.find((filter) => filter.value === commentFilter) || COMMENT_FILTERS[0];
  const filteredComments = useMemo(() => {
    if (commentFilter === 'recientes') {
      return [...comments].sort((a, b) => getCommentTime(b) - getCommentTime(a));
    }

    if (commentFilter === 'relevantes') {
      return [...comments].sort((a, b) => {
        const scoreDiff = getCommentRelevanceScore(b) - getCommentRelevanceScore(a);

        return scoreDiff || getCommentTime(b) - getCommentTime(a);
      });
    }

    return comments;
  }, [commentFilter, comments]);
  const visibleComments = useMemo(
    () => filteredComments.slice(0, visibleRootCommentsCount),
    [filteredComments, visibleRootCommentsCount]
  );
  const hasMoreComments = visibleRootCommentsCount < filteredComments.length;
  const currentUserLike = {
    idMiembros: user?.idMiembros,
    name: user?.displayName,
    avatarUrl: user?.photoURL,
  };
  const postLikes = post.personLikes || [];
  const currentUserAlreadyListed = postLikes.some(
    (person) =>
      (person.idMiembros &&
        user?.idMiembros &&
        Number(person.idMiembros) === Number(user.idMiembros)) ||
      (person.name && user?.displayName && person.name === user.displayName)
  );
  const displayedLikes =
    liked && !currentUserAlreadyListed ? [currentUserLike, ...postLikes] : postLikes;
  const authorName = author?.displayName || author?.name || 'Usuario';
  const authorPhotoURL = author?.photoURL || author?.avatarUrl || '';
  const authorIdMiembros = Number(author?.idMiembros || author?.id || 0);
  const userIdMiembros = Number(user?.idMiembros || user?.id || 0);
  const isPostAuthor =
    Boolean(authorIdMiembros && userIdMiembros && authorIdMiembros === userIdMiembros) ||
    Boolean(
      author?.codigoMiembro &&
      user?.codigoMiembro &&
      String(author.codigoMiembro) === String(user.codigoMiembro)
    );

  useEffect(() => {
    setComments(post.comments || []);
    setLiked(Boolean(post.isLikedByMe));
  }, [post.comments, post.isLikedByMe]);

  useEffect(() => {
    if (!detailDialogOpen) return;

    setVisibleRootCommentsCount(COMMENTS_PAGE_SIZE);
  }, [commentFilter, detailDialogOpen, post.id]);

  const commentExistsInPost = useCallback(
    (commentId) =>
      comments.some(
        (comment) =>
          comment.id === commentId ||
          (comment.replies || []).some((reply) => reply.id === commentId)
      ),
    [comments]
  );

  const getRootCommentIndex = useCallback(
    (commentId) =>
      filteredComments.findIndex(
        (comment) =>
          comment.id === commentId ||
          (comment.replies || []).some((reply) => reply.id === commentId)
      ),
    [filteredComments]
  );

  useEffect(() => {
    if (!detailDialogOpen || typeof window === 'undefined') return;

    const targetId = decodeURIComponent(window.location.hash.replace('#', ''));
    const commentId = targetId.startsWith('comment-') ? targetId.replace('comment-', '') : '';

    if (!commentId) return;

    const targetIndex = getRootCommentIndex(commentId);

    if (targetIndex >= 0) {
      setVisibleRootCommentsCount((current) =>
        Math.max(current, targetIndex + 1, COMMENTS_PAGE_SIZE)
      );
    }
  }, [detailDialogOpen, getRootCommentIndex]);

  useEffect(() => {
    if (!detailDialogOpen || !hasMoreComments || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const root = commentsScrollRef.current;
    const loader = commentsLoaderRef.current;

    if (!root || !loader) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        setVisibleRootCommentsCount((current) =>
          Math.min(current + COMMENTS_PAGE_SIZE, filteredComments.length)
        );
      },
      { root, rootMargin: '160px 0px', threshold: 0 }
    );

    observer.observe(loader);

    return () => observer.disconnect();
  }, [detailDialogOpen, filteredComments.length, hasMoreComments, visibleRootCommentsCount]);

  const focusHashTarget = useCallback(() => {
    if (typeof window === 'undefined') return;

    const targetId = decodeURIComponent(window.location.hash.replace('#', ''));
    const commentId = targetId.startsWith('comment-') ? targetId.replace('comment-', '') : '';
    const shouldHandleTarget =
      targetId === `post-${post.id}` || (commentId && commentExistsInPost(commentId));

    if (!targetId || !shouldHandleTarget) return;

    const targetElement = document.getElementById(targetId);

    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (commentId) {
      window.clearTimeout(highlightTimeoutRef.current);
      setHighlightedCommentId(commentId);
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedCommentId('');
      }, 2000);
    }
  }, [commentExistsInPost, post.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const frameId = window.requestAnimationFrame(focusHashTarget);

    window.addEventListener('hashchange', focusHashTarget);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(highlightTimeoutRef.current);
      window.removeEventListener('hashchange', focusHashTarget);
    };
  }, [focusHashTarget]);

  const handleChangeMessage = useCallback((event) => {
    setMessage(event.target.value);
  }, []);

  const handleInsertEmoji = useCallback((emoji) => {
    setMessage((currentMessage) =>
      `${currentMessage}${emoji}`.slice(0, PRINCIPAL_LIMITS.commentMessage)
    );
  }, []);

  const handleAttach = useCallback(() => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  }, []);

  const handleClickComment = useCallback(() => {
    if (detailDialogOpen) {
      commentRef.current?.focus();
      return;
    }

    setSelectedMediaIndex(0);
    setDetailDialogOpen(true);
  }, [detailDialogOpen]);

  const handleUploadCommentImage = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) return;

      const validationError = getPrincipalImageValidationError(file);

      if (validationError) {
        toast.error(validationError);
        return;
      }

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

  const handleSubmitComment = useCallback(async () => {
    const nextMessage = message.trim();

    if (commentSending) return;
    if (!nextMessage && !commentImage) return;

    const optimisticComment = createPendingComment({
      message: nextMessage,
      image: commentImage,
      user,
    });

    setComments((currentComments) => [...currentComments, optimisticComment]);
    setVisibleRootCommentsCount((current) =>
      Math.min(current + 1, Math.max(comments.length + 1, COMMENTS_PAGE_SIZE))
    );
    setMessage('');
    setCommentImage(null);
    setCommentSending(true);

    try {
      const nextComment = onAddComment
        ? await onAddComment(post, {
            mensaje: nextMessage,
            imagen: commentImage,
            optimisticId: optimisticComment.id,
          })
        : optimisticComment;

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === optimisticComment.id ? { ...nextComment, pending: false } : comment
        )
      );
      if (commentImage?.previewUrl) URL.revokeObjectURL(commentImage.previewUrl);
    } catch (error) {
      console.error(error);
      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === optimisticComment.id
            ? { ...comment, failed: true, pending: false }
            : comment
        )
      );
      toast.error('No se pudo enviar el comentario.');
    } finally {
      setCommentSending(false);
    }
  }, [commentImage, commentSending, comments.length, message, onAddComment, post, user]);

  const handleSubmitReply = useCallback(
    async (comment) => {
      const nextMessage = replyMessage.trim();

      if (replySending || !nextMessage) return;

      const optimisticReply = createPendingComment({
        message: nextMessage,
        user,
        idComentarioPadre: comment.id,
        replyToName: comment.author?.name || '',
      });

      setComments((currentComments) =>
        currentComments.map((currentComment) =>
          currentComment.id === comment.id
            ? { ...currentComment, replies: [...(currentComment.replies || []), optimisticReply] }
            : currentComment
        )
      );
      setReplyMessage('');
      setReplyingTo(null);
      setReplySending(true);

      try {
        const nextReply = onAddComment
          ? await onAddComment(post, {
              mensaje: nextMessage,
              idComentarioPadre: comment.id,
              comentarioPadre: comment,
              optimisticId: optimisticReply.id,
            })
          : optimisticReply;

        setComments((currentComments) =>
          currentComments.map((currentComment) =>
            currentComment.id === comment.id
              ? {
                  ...currentComment,
                  replies: (currentComment.replies || []).map((reply) =>
                    reply.id === optimisticReply.id ? { ...nextReply, pending: false } : reply
                  ),
                }
              : currentComment
          )
        );
      } catch (error) {
        console.error(error);
        setComments((currentComments) =>
          currentComments.map((currentComment) =>
            currentComment.id === comment.id
              ? {
                  ...currentComment,
                  replies: (currentComment.replies || []).map((reply) =>
                    reply.id === optimisticReply.id
                      ? { ...reply, failed: true, pending: false }
                      : reply
                  ),
                }
              : currentComment
          )
        );
        toast.error('No se pudo enviar la respuesta.');
      } finally {
        setReplySending(false);
      }
    },
    [onAddComment, post, replyMessage, replySending, user]
  );

  const getPostShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return `${paths.dashboard.principal}#post-${post.id}`;

    return `${window.location.origin}${paths.dashboard.principal}/#post-${post.id}`;
  }, [post.id]);

  const getShareText = useCallback(() => post.message || 'Publicacion compartida', [post.message]);

  const handleHidePost = useCallback(async () => {
    setMenuAnchorEl(null);
    try {
      await onHidePost?.(post);
      setHidden(true);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo ocultar el anuncio.');
    }
  }, [onHidePost, post]);

  const handleUndoHidePost = useCallback(async () => {
    try {
      await onUndoHidePost?.(post);
      setHidden(false);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo deshacer la accion.');
    }
  }, [onUndoHidePost, post]);

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
      await onReportPost?.(post, { razon: nextReason, url: shareUrl });

      const notification = await crearNotificacionReportePublicacion({
        publicacion: {
          idPublicacion: post.id,
          mensaje: post.message,
          url: shareUrl,
        },
        razon: nextReason,
        usuario: user,
      }).catch(() => null);

      if (!notification) {
        saveLocalReportNotification({ post, reason: nextReason, user, url: shareUrl });
      }

      setReported(true);
      setReportReason('');
      setReportDialogOpen(false);
      toast.success('Reporte enviado al equipo de moderación.');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo enviar el reporte.');
    } finally {
      setReportSending(false);
    }
  }, [getPostShareUrl, onReportPost, post, reportReason, user]);

  const handleCopyLink = useCallback(async () => {
    const shareUrl = getPostShareUrl();

    setShareAnchorEl(null);

    try {
      await onSharePost?.(post, { tipoDestino: 'enlace', urlCompartida: shareUrl }).catch((error) =>
        console.error(error)
      );
      await navigator.clipboard?.writeText(shareUrl);
      toast.success('Enlace copiado.');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo copiar el enlace.');
    }
  }, [getPostShareUrl, onSharePost, post]);

  const handleShareToChat = useCallback(() => {
    const shareUrl = getPostShareUrl();
    const shareText = `${getShareText()}\n${shareUrl}`;

    setShareAnchorEl(null);
    onSharePost?.(post, { tipoDestino: 'chat', urlCompartida: shareUrl }).catch((error) =>
      console.error(error)
    );
    router.push(`${paths.dashboard.chat}?share=${encodeURIComponent(shareText)}`);
  }, [getPostShareUrl, getShareText, onSharePost, post, router]);

  const handleNativeShare = useCallback(async () => {
    const shareUrl = getPostShareUrl();

    setShareAnchorEl(null);
    onSharePost?.(post, { tipoDestino: 'otra_app', urlCompartida: shareUrl }).catch((error) =>
      console.error(error)
    );

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
  }, [getPostShareUrl, getShareText, onSharePost, post, user?.displayName]);

  const handleSelectMedia = useCallback(
    (index) => {
      const nextMedia = mediaItems[index];

      if (!nextMedia || index === selectedMediaIndex || typeof window === 'undefined') {
        setSelectedMediaIndex(index);
        return;
      }

      const image = new window.Image();

      image.onload = () => setSelectedMediaIndex(index);
      image.onerror = () => setSelectedMediaIndex(index);
      image.src = nextMedia;
    },
    [mediaItems, selectedMediaIndex]
  );

  const handleOpenPreview = useCallback(
    (index) => {
      handleSelectMedia(index);
      setDetailDialogOpen(true);
    },
    [handleSelectMedia]
  );

  const handleClosePreview = useCallback(() => {
    setSelectedMediaIndex(0);
    setDetailDialogOpen(false);
    setCommentFilterAnchorEl(null);
  }, []);

  const handlePreviousMedia = useCallback(() => {
    const nextIndex = mediaItems.length
      ? (selectedMediaIndex - 1 + mediaItems.length) % mediaItems.length
      : 0;

    handleSelectMedia(nextIndex);
  }, [handleSelectMedia, mediaItems.length, selectedMediaIndex]);

  const handleNextMedia = useCallback(() => {
    const nextIndex = mediaItems.length ? (selectedMediaIndex + 1) % mediaItems.length : 0;

    handleSelectMedia(nextIndex);
  }, [handleSelectMedia, mediaItems.length, selectedMediaIndex]);

  const handleOpenDeleteDialog = useCallback(() => {
    setMenuAnchorEl(null);
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    if (deletingPost) return;

    setDeleteDialogOpen(false);
  }, [deletingPost]);

  const handleConfirmDeletePost = useCallback(async () => {
    setDeletingPost(true);

    try {
      await onDeletePost?.(post);
      setDeleteDialogOpen(false);
      toast.success('Publicacion borrada.');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'No se pudo borrar la publicacion.');
    } finally {
      setDeletingPost(false);
    }
  }, [onDeletePost, post]);

  const handleRememberPost = useCallback(
    async ({ date, canales = reminderChannels }) => {
      if (!date) return;

      setReminderSending(true);

      try {
        await onRememberPost?.(post, {
          fechaProgramada: date,
          canales,
        });
        setMenuAnchorEl(null);
        setReminderAnchorEl(null);
        setReminderDialogOpen(false);
        toast.success('Recordatorio programado.');
      } catch (error) {
        console.error(error);
        toast.error(error?.message || 'No se pudo programar el recordatorio.');
      } finally {
        setReminderSending(false);
      }
    },
    [onRememberPost, post, reminderChannels]
  );

  const handleRememberInDays = useCallback(
    (days) => {
      handleRememberPost({
        date: dayjs().add(days, 'day'),
        canales: { chat: false, correo: false },
      });
    },
    [handleRememberPost]
  );

  const handleOpenReminderDialog = useCallback(() => {
    setReminderAnchorEl(null);
    setMenuAnchorEl(null);
    setReminderDialogOpen(true);
  }, []);

  const clearReminderCloseTimeout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(reminderCloseTimeoutRef.current);
    }
  }, []);

  const clearReminderOpenTimeout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(reminderOpenTimeoutRef.current);
    }
  }, []);

  const trackReminderPointer = useCallback((event) => {
    reminderPointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const isPointInsideRect = useCallback(
    (point, rect, tolerance = 4) =>
      point.x >= rect.left - tolerance &&
      point.x <= rect.right + tolerance &&
      point.y >= rect.top - tolerance &&
      point.y <= rect.bottom + tolerance,
    []
  );

  const isPointInsideReminderArea = useCallback(
    (point) => {
      const reminderRect = reminderItemRef.current?.getBoundingClientRect();
      const submenuRect = reminderMenuPaperRef.current?.getBoundingClientRect();

      if (reminderRect && isPointInsideRect(point, reminderRect)) return true;
      if (submenuRect && isPointInsideRect(point, submenuRect)) return true;

      if (!reminderRect || !submenuRect) return false;

      const bridgeRect = {
        left: Math.min(reminderRect.right, submenuRect.left),
        right: Math.max(reminderRect.right, submenuRect.left),
        top: Math.min(reminderRect.top, submenuRect.top) - 8,
        bottom:
          Math.max(reminderRect.bottom, Math.min(submenuRect.bottom, reminderRect.bottom)) + 8,
      };

      return isPointInsideRect(point, bridgeRect, 0);
    },
    [isPointInsideRect]
  );

  const isPointerInsideReminderArea = useCallback(
    () => isPointInsideReminderArea(reminderPointerRef.current),
    [isPointInsideReminderArea]
  );

  const handleCloseReminderMenuSoon = useCallback(
    (event) => {
      if (typeof window === 'undefined') {
        setReminderAnchorEl(null);
        return;
      }

      if (event?.clientX !== undefined && event?.clientY !== undefined) {
        reminderPointerRef.current = { x: event.clientX, y: event.clientY };
      }

      clearReminderOpenTimeout();
      clearReminderCloseTimeout();

      if (!isPointerInsideReminderArea()) {
        setReminderAnchorEl(null);
      }
    },
    [clearReminderCloseTimeout, clearReminderOpenTimeout, isPointerInsideReminderArea]
  );

  const handleOpenReminderMenu = useCallback(
    (event) => {
      const anchorElement = event.currentTarget;

      trackReminderPointer(event);
      clearReminderOpenTimeout();
      clearReminderCloseTimeout();

      if (reminderMenuOpen) {
        setReminderAnchorEl(anchorElement);
        return;
      }

      reminderOpenTimeoutRef.current = window.setTimeout(() => {
        if (reminderItemRef.current === anchorElement && isPointerInsideReminderArea()) {
          setReminderAnchorEl(anchorElement);
        }
      }, REMINDER_MENU_OPEN_DELAY_MS);
    },
    [
      clearReminderCloseTimeout,
      clearReminderOpenTimeout,
      isPointerInsideReminderArea,
      reminderMenuOpen,
      trackReminderPointer,
    ]
  );

  const handleOpenReminderMenuNow = useCallback(
    (event) => {
      trackReminderPointer(event);
      clearReminderOpenTimeout();
      clearReminderCloseTimeout();
      setReminderAnchorEl(event.currentTarget);
    },
    [clearReminderCloseTimeout, clearReminderOpenTimeout, trackReminderPointer]
  );

  const handleCloseReminderMenu = useCallback(() => {
    clearReminderOpenTimeout();
    clearReminderCloseTimeout();
    setReminderAnchorEl(null);
  }, [clearReminderCloseTimeout, clearReminderOpenTimeout]);

  useEffect(() => {
    if (!reminderMenuOpen || typeof window === 'undefined') return undefined;

    const handleWindowMouseMove = (event) => {
      const point = { x: event.clientX, y: event.clientY };

      reminderPointerRef.current = point;

      if (!isPointInsideReminderArea(point)) {
        setReminderAnchorEl(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove, true);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove, true);
    };
  }, [isPointInsideReminderArea, reminderMenuOpen]);

  useEffect(
    () => () => {
      clearReminderOpenTimeout();
      clearReminderCloseTimeout();
    },
    [clearReminderCloseTimeout, clearReminderOpenTimeout]
  );

  const renderHead = () => (
    <>
      <CardHeader
        disableTypography
        avatar={
          <Link href={getProfileHref(author)} color="inherit" underline="none">
            <Avatar src={authorPhotoURL} alt={authorName}>
              {authorName.charAt(0).toUpperCase()}
            </Avatar>
          </Link>
        }
        title={
          <Link href={getProfileHref(author)} color="inherit" variant="subtitle1">
            {authorName}
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
        onClose={() => {
          setMenuAnchorEl(null);
          handleCloseReminderMenu();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList
          onMouseEnter={clearReminderCloseTimeout}
          onMouseMove={trackReminderPointer}
          onMouseLeave={handleCloseReminderMenuSoon}
          sx={{ minWidth: 210 }}
        >
          {isPostAuthor && (
            <MenuItem
              onMouseEnter={handleCloseReminderMenu}
              onClick={handleOpenDeleteDialog}
              sx={{ color: 'error.main' }}
            >
              <Iconify icon="solar:trash-bin-trash-bold" />
              Borrar publicacion
            </MenuItem>
          )}

          <MenuItem
            ref={reminderItemRef}
            selected={reminderMenuOpen}
            onMouseEnter={handleOpenReminderMenu}
            onMouseMove={trackReminderPointer}
            onClick={handleOpenReminderMenuNow}
            sx={{
              ...(reminderMenuOpen && {
                bgcolor: 'action.hover',
              }),
            }}
          >
            <Iconify icon="solar:bell-bing-bold" />
            Recordar esta publicacion
            <Iconify icon="eva:arrow-ios-forward-fill" width={16} sx={{ ml: 'auto' }} />
          </MenuItem>

          <MenuItem onMouseEnter={handleCloseReminderMenu} onClick={handleHidePost}>
            <Iconify icon="solar:eye-closed-bold" />
            Ocultar anuncio
          </MenuItem>

          <MenuItem onMouseEnter={handleCloseReminderMenu} onClick={handleOpenReportDialog}>
            <Iconify icon="solar:flag-bold" />
            Reportar anuncio
          </MenuItem>
        </MenuList>
      </Popover>

      <Popover
        open={reminderMenuOpen}
        anchorEl={reminderAnchorEl}
        onClose={() => setReminderAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            ref: reminderMenuPaperRef,
            onMouseEnter: clearReminderCloseTimeout,
            onMouseMove: trackReminderPointer,
            onMouseLeave: () => {
              handleCloseReminderMenuSoon();
            },
          },
        }}
      >
        <MenuList sx={{ minWidth: 250 }}>
          <MenuItem onClick={() => handleRememberInDays(1)}>Recordar en 1 dia</MenuItem>
          <MenuItem onClick={() => handleRememberInDays(3)}>Recordar en 3 dias</MenuItem>
          <MenuItem onClick={() => handleRememberInDays(7)}>Recordar en 7 dias</MenuItem>
          <MenuItem onClick={() => handleRememberInDays(15)}>Recordar en 15 dias</MenuItem>
          <MenuItem onClick={() => handleRememberInDays(30)}>Recordar en 30 dias</MenuItem>
          <MenuItem onClick={handleOpenReminderDialog}>
            <Iconify icon="solar:calendar-add-bold" />
            Programar una notificacion
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );

  const renderCommentContent = (comment) => (
    <Paper
      id={`comment-${comment.id}`}
      sx={(theme) => ({
        p: 1.5,
        flexGrow: 1,
        scrollMarginTop: 96,
        bgcolor:
          highlightedCommentId === comment.id
            ? varAlpha(theme.vars.palette.warning.mainChannel, 0.18)
            : 'background.neutral',
        boxShadow:
          highlightedCommentId === comment.id
            ? `0 0 0 2px ${varAlpha(theme.vars.palette.warning.mainChannel, 0.36)}`
            : 'none',
        transition: theme.transitions.create(['background-color', 'box-shadow'], {
          duration: theme.transitions.duration.shorter,
        }),
      })}
    >
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

      {comment.replyToName && (
        <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.disabled' }}>
          Respuesta a {comment.replyToName}
        </Typography>
      )}

      {comment.failed && (
        <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'error.main' }}>
          No se pudo enviar
        </Typography>
      )}

      <Box sx={{ typography: 'body2', color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
        {renderTextWithHashtags(comment.message)}
      </Box>

      {comment.imageUrl && (
        <Box
          component="img"
          loading="lazy"
          decoding="async"
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
  );

  const renderReplyInput = (comment) =>
    replyingTo?.id === comment.id && (
      <Box sx={{ gap: 1.25, pl: 7, display: 'flex', alignItems: 'center' }}>
        <Avatar src={user?.photoURL} alt={user?.displayName} sx={{ width: 32, height: 32 }}>
          {user?.displayName?.charAt(0).toUpperCase()}
        </Avatar>

        <InputBase
          fullWidth
          autoFocus
          value={replyMessage}
          placeholder={`Responder a ${comment.author.name}...`}
          onChange={(event) => setReplyMessage(event.target.value)}
          onKeyUp={(event) => {
            if (event.key === 'Enter') {
              handleSubmitReply(comment);
            }
          }}
          endAdornment={
            <InputAdornment position="end" sx={{ mr: 1 }}>
              <IconButton
                size="small"
                color="primary"
                disabled={replySending || !replyMessage.trim()}
                onClick={() => handleSubmitReply(comment)}
              >
                <Iconify icon="solar:plain-bold" />
              </IconButton>
            </InputAdornment>
          }
          inputProps={{
            maxLength: PRINCIPAL_LIMITS.commentMessage,
            'aria-label': `Responder a ${comment.author.name}`,
          }}
          sx={[
            (theme) => ({
              pl: 1.5,
              minHeight: 38,
              borderRadius: 1,
              border: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.32)}`,
            }),
          ]}
        />
      </Box>
    );

  const renderCommentFilter = () => (
    <Box sx={{ px: 3, pt: 2, pb: 1 }}>
      <Button
        color="inherit"
        size="small"
        onClick={(event) => setCommentFilterAnchorEl(event.currentTarget)}
        endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
        sx={{ px: 0, fontWeight: 700 }}
      >
        {currentCommentFilter.label}
      </Button>

      <Popover
        open={commentFilterMenuOpen}
        anchorEl={commentFilterAnchorEl}
        onClose={() => setCommentFilterAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuList sx={{ width: 360, maxWidth: 'calc(100vw - 32px)', p: 1 }}>
          {COMMENT_FILTERS.map((filter) => (
            <MenuItem
              key={filter.value}
              selected={commentFilter === filter.value}
              onClick={() => {
                setCommentFilter(filter.value);
                setCommentFilterAnchorEl(null);
              }}
              sx={{
                gap: 0.5,
                py: 1.25,
                px: 1.5,
                display: 'block',
                whiteSpace: 'normal',
              }}
            >
              <Typography variant="subtitle2">{filter.label}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {filter.description}
              </Typography>
            </MenuItem>
          ))}
        </MenuList>
      </Popover>
    </Box>
  );

  const renderCommentList = () => (
    <Stack spacing={1.5} sx={{ px: 3, pb: 2 }}>
      {visibleComments.map((comment) => (
        <Stack key={comment.id} spacing={1}>
          <Box sx={{ gap: 2, display: 'flex' }}>
            <Avatar alt={comment.author.name} src={comment.author.avatarUrl} slotProps={{ img: { loading: 'lazy', decoding: 'async' } }} />

            <Box sx={{ flexGrow: 1 }}>
              {renderCommentContent(comment)}

              <Button
                size="small"
                color="inherit"
                sx={{ mt: 0.25, ml: 0.5, color: 'text.secondary' }}
                onClick={() => {
                  setReplyingTo(comment);
                  setReplyMessage('');
                }}
              >
                Responder
              </Button>
            </Box>
          </Box>

          {!!comment.replies?.length && (
            <Stack spacing={1} sx={{ pl: 7 }}>
              {comment.replies.map((reply) => (
                <Box key={reply.id} sx={{ gap: 1.5, display: 'flex' }}>
                  <Avatar
                    slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
                    alt={reply.author.name}
                    src={reply.author.avatarUrl}
                    sx={{ width: 32, height: 32 }}
                  />
                  {renderCommentContent(reply)}
                </Box>
              ))}
            </Stack>
          )}

          {renderReplyInput(comment)}
        </Stack>
      ))}

      {hasMoreComments && (
        <Box ref={commentsLoaderRef} sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Button
            size="small"
            color="inherit"
            onClick={() =>
              setVisibleRootCommentsCount((current) =>
                Math.min(current + COMMENTS_PAGE_SIZE, filteredComments.length)
              )
            }
          >
            Cargar más comentarios
          </Button>
        </Box>
      )}
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
            loading="lazy"
            decoding="async"
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
                disabled={commentSending || (!message.trim() && !commentImage)}
                onClick={handleSubmitComment}
              >
                <Iconify icon="solar:plain-bold" />
              </IconButton>
            </InputAdornment>
          }
          inputProps={{
            id: `comment-${post.id}-input`,
            maxLength: PRINCIPAL_LIMITS.commentMessage,
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
        accept={PRINCIPAL_IMAGE_ACCEPT}
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
          <Box
            component="button"
            type="button"
            onClick={() => handleOpenPreview(0)}
            aria-label="Abrir imagen de la publicacion"
            // Sin proporcion fija: la imagen manda. Con 4/3 y `cover` se recortaba
            // lo que no cupiera —a un certificado se le comian los bordes—.
            sx={{
              p: 0,
              m: 0,
              border: 0,
              width: 1,
              display: 'block',
              overflow: 'hidden',
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: 'background.neutral',
              // Sitio reservado mientras la foto no ha llegado. En cuanto se mide
              // sola, se suelta: la proporcion la sigue mandando la imagen.
              ...(fotoSueltaMedida ? null : { minHeight: { xs: 320, sm: 420 } }),
            }}
          >
            <Box
              component="img"
              loading="lazy"
              decoding="async"
              alt={post.message || post.media}
              src={mediaItems[0]}
              onLoad={() => setFotoSueltaMedida(true)}
              // Si la foto no carga, se suelta igual: dejar el hueco abierto
              // para siempre seria peor que no haberlo reservado.
              onError={() => setFotoSueltaMedida(true)}
              sx={{
                width: 1,
                height: 'auto',
                display: 'block',
                // Tope para que una foto muy vertical no ocupe la pantalla entera.
                maxHeight: { xs: '70vh', sm: '75vh' },
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
          </Box>
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
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(2, minmax(0, 1fr))',
            },
          },
        ]}
      >
        {visibleMediaItems.map((media, index) => {
          const showMoreOverlay = index === MEDIA_PREVIEW_LIMIT - 1 && hiddenMediaCount > 0;

          return (
            <Box
              component="button"
              type="button"
              key={`${media}-${index}`}
              onClick={() => handleOpenPreview(index)}
              aria-label={`Abrir imagen ${index + 1} de ${mediaItems.length}`}
              sx={{
                p: 0,
                m: 0,
                border: 0,
                width: 1,
                aspectRatio: '1 / 1',
                display: 'block',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1.5,
                cursor: 'pointer',
                bgcolor: 'background.neutral',
              }}
            >
              <Box
                component="img"
                loading="lazy"
                decoding="async"
                alt={`${post.message || 'Publicacion'} ${index + 1}`}
                src={media}
                sx={{
                  width: 1,
                  height: 1,
                  display: 'block',
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              />

              {showMoreOverlay && (
                <Box
                  sx={{
                    inset: 0,
                    gap: 0.5,
                    display: 'flex',
                    position: 'absolute',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'common.white',
                    bgcolor: 'rgba(0, 0, 0, 0.48)',
                    typography: { xs: 'h5', sm: 'h4' },
                    fontWeight: 700,
                  }}
                >
                  +{hiddenMediaCount}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderActions = ({ withSharePopover = true } = {}) => (
    <>
      <Box
        sx={[(theme) => ({ display: 'flex', alignItems: 'center', p: theme.spacing(2, 3, 3, 3) })]}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={liked}
              disabled={likeSending}
              color="error"
              icon={<Iconify icon="solar:heart-bold" />}
              checkedIcon={<Iconify icon="solar:heart-bold" />}
              onChange={async (event) => {
                const nextLiked = event.target.checked;
                const previousLiked = liked;

                setLiked(nextLiked);
                setLikeSending(true);

                try {
                  await onToggleLike?.(post, nextLiked);
                } catch (error) {
                  console.error(error);
                  setLiked(previousLiked);
                  toast.error('No se pudo actualizar el like.');
                } finally {
                  setLikeSending(false);
                }
              }}
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
              mr: 1,
              [`& .${avatarGroupClasses.avatar}`]: {
                width: 32,
                height: 32,
              },
            }}
          >
            {displayedLikes.map((person, index) => (
              <Avatar key={`${person.name}-${index}`} alt={person.name} src={person.avatarUrl} slotProps={{ img: { loading: 'lazy', decoding: 'async' } }} />
            ))}
          </AvatarGroup>
        )}

        <Button
          size="small"
          color="inherit"
          startIcon={<Iconify icon="solar:chat-round-dots-bold" />}
          onClick={handleClickComment}
          sx={{ mr: 1, color: 'text.secondary' }}
        >
          {fShortenNumber(commentsCount)}
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        <IconButton onClick={(event) => setShareAnchorEl(event.currentTarget)}>
          <Iconify icon="solar:share-bold" />
        </IconButton>
      </Box>

      {withSharePopover && (
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
      )}
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
      <DialogTitle>Reportar publicación</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Explica brevemente el problema. El equipo de moderación revisará el contenido.
        </Typography>

        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={4}
          label="Motivo"
          value={reportReason}
          disabled={reportSending}
          onChange={(event) => setReportReason(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          helperText={`${reportReason.length} / 500`}
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

  const renderDeleteDialog = () => (
    <Dialog fullWidth maxWidth="xs" open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
      <DialogTitle>Eliminar publicación</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Esta acción ocultará la publicación para todos. ¿Deseas continuar?
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" disabled={deletingPost} onClick={handleCloseDeleteDialog}>
          Cancelar
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={deletingPost}
          onClick={handleConfirmDeletePost}
        >
          Borrar
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderReminderDialog = () => (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={reminderDialogOpen}
      onClose={() => !reminderSending && setReminderDialogOpen(false)}
    >
      <DialogTitle>Programar notificacion</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          <DateTimePicker
            label="Fecha y hora"
            value={reminderDate}
            minDateTime={dayjs()}
            onChange={(newValue) => setReminderDate(newValue)}
            slotProps={{ textField: { fullWidth: true } }}
          />

          <Stack>
            <FormControlLabel
              control={
                <Checkbox checked disabled slotProps={{ input: { 'aria-label': 'Campanita' } }} />
              }
              label="Campanita"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={reminderChannels.chat}
                  onChange={(event) =>
                    setReminderChannels((current) => ({
                      ...current,
                      chat: event.target.checked,
                    }))
                  }
                  slotProps={{ input: { 'aria-label': 'Chat' } }}
                />
              }
              label="Chat"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={reminderChannels.correo}
                  onChange={(event) =>
                    setReminderChannels((current) => ({
                      ...current,
                      correo: event.target.checked,
                    }))
                  }
                  slotProps={{ input: { 'aria-label': 'Correo' } }}
                />
              }
              label="Correo"
            />
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          color="inherit"
          disabled={reminderSending}
          onClick={() => setReminderDialogOpen(false)}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={reminderSending || !reminderDate}
          onClick={() => handleRememberPost({ date: reminderDate, canales: reminderChannels })}
        >
          Programar
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderDetailDialog = () => (
    <Dialog
      fullWidth
      maxWidth="md"
      open={detailDialogOpen}
      onClose={handleClosePreview}
      slotProps={{
        paper: {
          sx: {
            overflow: 'hidden',
            width: '95%',
            maxHeight: { xs: '92vh', md: '88vh' },
            bgcolor: 'background.paper',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          px: 7,
          py: 2,
          textAlign: 'center',
          borderBottom: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        }}
      >
        Publicación de {authorName}
        <IconButton
          onClick={handleClosePreview}
          sx={{
            top: 10,
            right: 12,
            position: 'absolute',
            bgcolor: 'background.neutral',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <DialogContent ref={commentsScrollRef} sx={{ p: 0, overflow: 'auto' }}>
        <CardHeader
          disableTypography
          avatar={
            <Link href={getProfileHref(author)} color="inherit" underline="none">
              <Avatar src={authorPhotoURL} alt={authorName}>
                {authorName.charAt(0).toUpperCase()}
              </Avatar>
            </Link>
          }
          title={
            <Link href={getProfileHref(author)} color="inherit" variant="subtitle1">
              {authorName}
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

        {post.message && (
          <Typography variant="body2" sx={[(theme) => ({ px: 3, pb: 2, whiteSpace: 'pre-wrap' })]}>
            {renderTextWithHashtags(post.message)}
          </Typography>
        )}

        {selectedMedia && (
          <Box
            sx={{
              position: 'relative',
              bgcolor: 'background.neutral',
            }}
          >
            <Box
              component="img"
              loading="lazy"
              decoding="async"
              src={selectedMedia}
              alt={post.message || 'Publicación'}
              sx={{
                width: 1,
                height: { xs: 360, sm: 460, md: 560 },
                maxHeight: { xs: 420, md: 560 },
                display: 'block',
                objectFit: 'contain',
                objectPosition: 'center',
                bgcolor: 'background.neutral',
              }}
            />

            {hasMultipleMedia && (
              <>
                <IconButton
                  color="inherit"
                  onClick={handlePreviousMedia}
                  aria-label="Imagen anterior"
                  sx={{
                    top: '50%',
                    left: 12,
                    position: 'absolute',
                    color: 'common.white',
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(0, 0, 0, 0.45)',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.62)' },
                  }}
                >
                  <Iconify icon="eva:arrow-ios-back-fill" />
                </IconButton>

                <IconButton
                  color="inherit"
                  onClick={handleNextMedia}
                  aria-label="Imagen siguiente"
                  sx={{
                    top: '50%',
                    right: 12,
                    position: 'absolute',
                    color: 'common.white',
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(0, 0, 0, 0.45)',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.62)' },
                  }}
                >
                  <Iconify icon="eva:arrow-ios-forward-fill" />
                </IconButton>

                <Box
                  sx={{
                    right: 16,
                    bottom: 16,
                    px: 1.25,
                    py: 0.5,
                    position: 'absolute',
                    borderRadius: 999,
                    color: 'common.white',
                    bgcolor: 'rgba(0, 0, 0, 0.54)',
                    typography: 'caption',
                    fontWeight: 700,
                  }}
                >
                  {selectedMediaIndex + 1} / {mediaItems.length}
                </Box>
              </>
            )}
          </Box>
        )}

        {renderActions({ withSharePopover: false })}

        <Divider />

        {renderCommentFilter()}
        {commentsCount ? (
          renderCommentList()
        ) : (
          <Typography variant="body2" sx={{ px: 3, pb: 2, color: 'text.secondary' }}>
            Aún no hay comentarios.
          </Typography>
        )}
      </DialogContent>

      <Box
        sx={{
          pt: 2,
          borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
          bgcolor: 'background.paper',
        }}
      >
        {renderInput()}
      </Box>
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
        </Card>
      )}

      {renderReportDialog()}
      {renderDeleteDialog()}
      {renderReminderDialog()}
      {renderDetailDialog()}
    </>
  );
}
