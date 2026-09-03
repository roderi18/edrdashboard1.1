import { v4 as uuidv4 } from 'uuid';
import { varAlpha } from 'minimal-shared/utils';
import { useRef, useState, useEffect, useCallback } from 'react';

import Fab from '@mui/material/Fab';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Skeleton from '@mui/material/Skeleton';
import InputBase from '@mui/material/InputBase';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import {
  PRINCIPAL_LIMITS,
  PRINCIPAL_IMAGE_ACCEPT,
  getPrincipalImageValidationError,
} from 'src/utils/principal-content';

import { _appFeatured } from 'src/_mock';
import {
  obtenerResumenSocialPrincipal,
  aceptarSolicitudAmistadPrincipal,
  eliminarSolicitudAmistadPrincipal,
} from 'src/services/principal-social-service';
import {
  getPrincipalMemberId,
  crearPublicacionPrincipal,
  crearComentarioPublicacion,
  alternarReaccionPublicacion,
  registrarReportePublicacion,
  ocultarPublicacionPrincipal,
  crearRecordatorioPublicacion,
  eliminarPublicacionPrincipal,
  obtenerPublicacionesPrincipal,
  registrarCompartidoPublicacion,
  deshacerOcultarPublicacionPrincipal,
} from 'src/services/principal-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { AppFeatured } from 'src/sections/prinicipal/app/app-featured';

import { ProfilePostItem } from './profile-post-item';
import { ProfileEmojiPicker } from './profile-emoji-picker';

// ----------------------------------------------------------------------

const MAX_POST_IMAGES = PRINCIPAL_LIMITS.imagesPerPost;
// Requiere un arrastre real de unos 240px. Es deliberadamente más largo que
// un gesto casual al intentar comenzar a desplazarse por el muro.
const PULL_REFRESH_THRESHOLD = 100;
const PULL_REFRESH_MAX_DISTANCE = 150;
const PULL_REFRESH_RESISTANCE = 0.42;
// Interruptor temporal: ponerlo en `false` devuelve el espaciado móvil anterior
// sin tocar la carga, proporción ni optimización de las imágenes.
const MOBILE_EDGE_TO_EDGE_POSTS = true;
const BIRTHDAY_PRESET_MESSAGES = [
  'Dios te bendiga, feliz cumpleaños. 🙏 🎉',
  'Que Dios te regale un año lleno de salud, gozo y paz. 🙌 🎂',
  'Feliz cumpleaños, que el Señor guíe cada paso de tu vida. ✨',
  'Bendiciones en tu día, que sigas creciendo con alegría. 🎁',
];

const getBirthdayDefaultMessage = (friend) =>
  `¡Feliz cumpleaños, ${friend.nombre}! Dios te bendiga en este nuevo año de vida. 🎉`;

export function ProfileHome({ info, posts, user, perfilIdMiembros = null, sx, ...other }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const postImagesRef = useRef([]);
  const [feedPosts, setFeedPosts] = useState(posts);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [postsCursor, setPostsCursor] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [postImages, setPostImages] = useState([]);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [emojiCategory, setEmojiCategory] = useState('Caras');
  const [socialData, setSocialData] = useState({
    solicitudesAmistad: [],
    cumpleanerosHoy: [],
    proximosCumpleanos: [],
  });
  const [birthdayAnchorEl, setBirthdayAnchorEl] = useState(null);
  const [showUpcomingBirthdays, setShowUpcomingBirthdays] = useState(false);
  const [birthdayMessages, setBirthdayMessages] = useState({});
  const [pullRefreshDistance, setPullRefreshDistance] = useState(0);
  const [refreshingByPull, setRefreshingByPull] = useState(false);
  const pullRefreshRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    distance: 0,
    thresholdNotified: false,
  });

  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const birthdayPopoverOpen = Boolean(birthdayAnchorEl);
  const usuarioIdMiembros = getPrincipalMemberId(user);
  const autorIdMiembros = Number(perfilIdMiembros || 0) || null;
  const canPublish =
    !autorIdMiembros ||
    (usuarioIdMiembros && Number(usuarioIdMiembros) === Number(autorIdMiembros));
  const friendRequests = socialData.solicitudesAmistad;
  const birthdayFriends = socialData.cumpleanerosHoy;
  const upcomingBirthdays = socialData.proximosCumpleanos;
  postImagesRef.current = postImages;

  useEffect(
    () => () => {
      postImagesRef.current.forEach((image) => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
    },
    []
  );

  const loadSocialData = useCallback(async () => {
    try {
      const nextSocialData = await obtenerResumenSocialPrincipal(user);

      setSocialData(nextSocialData);
    } catch (error) {
      console.error(error);
      setSocialData({
        solicitudesAmistad: [],
        cumpleanerosHoy: [],
        proximosCumpleanos: [],
      });
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    const loadPosts = async () => {
      setLoadingPosts(true);

      try {
        const page = await obtenerPublicacionesPrincipal({
          usuarioIdMiembros,
          autorIdMiembros,
          mocks: posts,
        });

        if (active) {
          setFeedPosts(page.items);
          setPostsCursor(page.nextCursor);
          setHasMorePosts(page.hasMore);
        }
      } catch (error) {
        console.error(error);

        if (active) {
          setFeedPosts(posts);
        }
      } finally {
        if (active) {
          setLoadingPosts(false);
        }
      }
    };

    loadPosts();

    return () => {
      active = false;
    };
  }, [autorIdMiembros, posts, usuarioIdMiembros]);

  const handleLoadMorePosts = useCallback(async () => {
    if (!postsCursor || loadingMorePosts) return;

    setLoadingMorePosts(true);

    try {
      const page = await obtenerPublicacionesPrincipal({
        usuarioIdMiembros,
        autorIdMiembros,
        cursorFecha: postsCursor,
        mocks: [],
      });

      setFeedPosts((currentPosts) => {
        const existingIds = new Set(currentPosts.map((post) => post.id));
        return [...currentPosts, ...page.items.filter((post) => !existingIds.has(post.id))];
      });
      setPostsCursor(page.nextCursor);
      setHasMorePosts(page.hasMore);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar más publicaciones.');
    } finally {
      setLoadingMorePosts(false);
    }
  }, [autorIdMiembros, loadingMorePosts, postsCursor, usuarioIdMiembros]);

  // El centinela del final del muro: mientras haya mas, deslizar hasta el trae
  // la pagina siguiente. Se desconecta al desmontar y cada vez que cambian las
  // condiciones, para no dejar observadores sueltos.
  const centinelaPublicaciones = useRef(null);

  useEffect(() => {
    const nodo = centinelaPublicaciones.current;

    if (!nodo || !hasMorePosts || loadingMorePosts || loadingPosts) return undefined;

    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) handleLoadMorePosts();
      },
      // Se adelanta 200px: cuando el lector llega al final, lo siguiente ya esta.
      { rootMargin: '200px' }
    );

    observador.observe(nodo);

    return () => observador.disconnect();
  }, [hasMorePosts, loadingMorePosts, loadingPosts, handleLoadMorePosts]);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  useEffect(() => {
    const isSmallScreen = () => window.matchMedia('(max-width: 600px)').matches;

    const resetPull = () => {
      pullRefreshRef.current = {
        active: false,
        startX: 0,
        startY: 0,
        distance: 0,
        thresholdNotified: false,
      };
      setPullRefreshDistance(0);
    };

    const handleTouchStart = (event) => {
      if (!isSmallScreen() || refreshingByPull || window.scrollY > 0 || event.touches.length !== 1) {
        return;
      }

      if (event.target.closest('input, textarea, select, [role="dialog"]')) return;

      const touch = event.touches[0];
      pullRefreshRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        distance: 0,
        thresholdNotified: false,
      };
    };

    const handleTouchMove = (event) => {
      const gesture = pullRefreshRef.current;
      if (!gesture.active || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      // Un movimiento horizontal pertenece a la galería, no a la recarga.
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        resetPull();
        return;
      }

      if (deltaY <= 0 || window.scrollY > 0) {
        resetPull();
        return;
      }

      if (event.cancelable) event.preventDefault();

      const distance = Math.min(PULL_REFRESH_MAX_DISTANCE, deltaY * PULL_REFRESH_RESISTANCE);
      gesture.distance = distance;

      if (distance >= PULL_REFRESH_THRESHOLD && !gesture.thresholdNotified) {
        gesture.thresholdNotified = true;
        navigator.vibrate?.(24);
      }

      setPullRefreshDistance(distance);
    };

    const handleTouchEnd = () => {
      const shouldRefresh = pullRefreshRef.current.distance >= PULL_REFRESH_THRESHOLD;

      if (!shouldRefresh) {
        resetPull();
        return;
      }

      pullRefreshRef.current.active = false;
      setPullRefreshDistance(PULL_REFRESH_THRESHOLD);
      setRefreshingByPull(true);
      navigator.vibrate?.([32, 28, 42]);

      // Deja que el usuario alcance a ver el estado de recarga antes de que el
      // navegador sustituya el documento.
      window.setTimeout(() => window.location.reload(), 180);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', resetPull, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, [refreshingByPull]);

  useEffect(() => {
    setBirthdayMessages((currentMessages) => ({
      ...Object.fromEntries(
        birthdayFriends.map((friend) => [
          friend.id,
          currentMessages[friend.id] || getBirthdayDefaultMessage(friend),
        ])
      ),
    }));
  }, [birthdayFriends]);

  const handleAttach = () => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  };

  const handleChangePostMessage = useCallback((event) => {
    setPostMessage(event.target.value);
  }, []);

  const handleInsertEmoji = useCallback((emoji) => {
    setPostMessage((currentMessage) =>
      `${currentMessage}${emoji}`.slice(0, PRINCIPAL_LIMITS.postMessage)
    );
  }, []);

  const handleUploadImages = useCallback(
    (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = '';

      if (!files.length) return;

      const validFiles = files.filter((file) => {
        const validationError = getPrincipalImageValidationError(file);

        if (validationError) toast.error(`${file.name}: ${validationError}`);
        return !validationError;
      });
      const remainingSlots = MAX_POST_IMAGES - postImages.length;

      if (remainingSlots <= 0) {
        toast.error(`Puedes cargar un máximo de ${MAX_POST_IMAGES} imágenes por publicación.`);
        return;
      }

      const currentFileKeys = new Set(
        postImages.map(
          (image) => `${image.file.name}-${image.file.size}-${image.file.lastModified}`
        )
      );
      const uniqueFiles = validFiles.filter(
        (file) => !currentFileKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
      );
      const acceptedFiles = uniqueFiles.slice(0, remainingSlots);

      if (acceptedFiles.length < uniqueFiles.length) {
        toast.error(`Puedes cargar un máximo de ${MAX_POST_IMAGES} imágenes por publicación.`);
      }

      setPostImages((currentImages) => [
        ...currentImages,
        ...acceptedFiles.map((file, index) => ({
          id: `post-image-${file.name}-${file.size}-${file.lastModified}-${index}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    },
    [postImages]
  );

  const handleRemoveImage = useCallback((imageId) => {
    setPostImages((currentImages) =>
      currentImages.filter((image) => {
        if (image.id === imageId) {
          URL.revokeObjectURL(image.previewUrl);
          return false;
        }

        return true;
      })
    );
  }, []);

  const handlePublishPost = useCallback(async () => {
    const nextMessage = postMessage.trim();

    if (!nextMessage && !postImages.length) return;

    // LA PUBLICACION APARECE AL MOMENTO.
    //
    // Antes no salia hasta que terminaba TODO: subir las fotos a Storage y
    // guardar el documento. Con varias fotos eso son segundos mirando un boton
    // girar, con el texto todavia en la caja, sin saber si se estaba enviando.
    //
    // Ahora se pinta enseguida, marcada como pendiente, y con las fotos que ya
    // estan en el navegador —las mismas que se ven en la vista previa, asi que
    // no hay que esperar a que suban para verlas—. Cuando el servidor devuelve
    // la de verdad, se sustituye en su sitio.
    const idOptimista = uuidv4();
    const publicacionOptimista = {
      id: idOptimista,
      pending: true,
      createdAt: new Date().toISOString(),
      message: nextMessage,
      media: postImages[0]?.previewUrl || '',
      mediaItems: postImages.map((imagen) => imagen.previewUrl).filter(Boolean),
      mediaDetails: [],
      personLikes: [],
      comments: [],
      isLikedByMe: false,
      author: {
        id: user?.idMiembros || user?.id || user?.uid || 'usuario-actual',
        uid: user?.uid || '',
        idMiembros: user?.idMiembros,
        codigoMiembro: user?.codigoMiembro,
        correo: user?.correo || user?.email || '',
        name: user?.displayName || user?.nombre || 'Usuario',
        avatarUrl: user?.photoURL,
      },
    };

    const imagenesEnviadas = postImages;

    setFeedPosts((currentPosts) => [publicacionOptimista, ...currentPosts]);
    setPostMessage('');
    setPostImages([]);

    try {
      const nextPost = await crearPublicacionPrincipal({
        mensaje: nextMessage,
        imagenes: imagenesEnviadas,
        usuario: user,
      });

      setFeedPosts((currentPosts) =>
        currentPosts.map((post) => (post.id === idOptimista ? nextPost : post))
      );
      // Las vistas previas se sueltan DESPUES de sustituirla: hasta ese momento
      // son lo que se esta viendo en pantalla.
      imagenesEnviadas.forEach((image) => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
    } catch (error) {
      console.error(error);

      // Se retira lo que no llego a existir y se DEVUELVE lo escrito: perder el
      // texto de alguien porque fallo la red seria lo peor que podria pasar
      // aqui.
      setFeedPosts((currentPosts) => currentPosts.filter((post) => post.id !== idOptimista));
      setPostMessage(nextMessage);
      setPostImages(imagenesEnviadas);
      toast.error(error?.message || 'No se pudo crear la publicación. Vuelve a intentarlo.');
    }
  }, [postImages, postMessage, user]);

  const handleAddComment = useCallback(
    async (
      post,
      { mensaje, imagen, idComentarioPadre = '', comentarioPadre = null, optimisticId = '' }
    ) => {
      const nextComment = await crearComentarioPublicacion({
        idPublicacion: post.id,
        mensaje,
        imagen,
        usuario: user,
        idComentarioPadre,
        comentarioPadre,
      });

      setFeedPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                comments: nextComment.idComentarioPadre
                  ? (currentPost.comments || []).map((comment) =>
                      comment.id === nextComment.idComentarioPadre
                        ? {
                            ...comment,
                            replies:
                              optimisticId &&
                              (comment.replies || []).some((reply) => reply.id === optimisticId)
                                ? (comment.replies || []).map((reply) =>
                                    reply.id === optimisticId ? nextComment : reply
                                  )
                                : [...(comment.replies || []), nextComment],
                          }
                        : comment
                    )
                  : optimisticId &&
                      (currentPost.comments || []).some((comment) => comment.id === optimisticId)
                    ? (currentPost.comments || []).map((comment) =>
                        comment.id === optimisticId ? nextComment : comment
                      )
                    : [...(currentPost.comments || []), nextComment],
                cantidadComentarios: Number(currentPost.cantidadComentarios || 0) + 1,
              }
            : currentPost
        )
      );

      return nextComment;
    },
    [user]
  );

  const handleToggleLike = useCallback(
    async (post, active) => {
      const like = await alternarReaccionPublicacion({
        idPublicacion: post.id,
        usuario: user,
        activo: active,
      });

      setFeedPosts((currentPosts) =>
        currentPosts.map((currentPost) => {
          if (currentPost.id !== post.id) return currentPost;

          const personLikes = currentPost.personLikes || [];
          const nextLikes = active
            ? [
                like,
                ...personLikes.filter(
                  (person) => Number(person.idMiembros) !== Number(like.idMiembros)
                ),
              ]
            : personLikes.filter((person) => Number(person.idMiembros) !== Number(like.idMiembros));

          return {
            ...currentPost,
            isLikedByMe: active,
            personLikes: nextLikes,
            cantidadLikes: nextLikes.length,
          };
        })
      );

      return like;
    },
    [user]
  );

  const handleHidePost = useCallback(
    async (post) => {
      await ocultarPublicacionPrincipal({ idPublicacion: post.id, usuario: user });
    },
    [user]
  );

  const handleUndoHidePost = useCallback(
    async (post) => {
      await deshacerOcultarPublicacionPrincipal({ idPublicacion: post.id, usuario: user });
    },
    [user]
  );

  const handleSharePost = useCallback(
    async (post, { tipoDestino, idDestino = '', urlCompartida = '' }) => {
      await registrarCompartidoPublicacion({
        idPublicacion: post.id,
        usuario: user,
        tipoDestino,
        idDestino,
        urlCompartida,
      });
    },
    [user]
  );

  const handleReportPost = useCallback(
    async (post, { razon }) => {
      await registrarReportePublicacion({
        idPublicacion: post.id,
        usuario: user,
        razon,
      });
    },
    [user]
  );

  const handleDeletePost = useCallback(
    async (post) => {
      await eliminarPublicacionPrincipal({ idPublicacion: post.id, usuario: user });
      setFeedPosts((currentPosts) =>
        currentPosts.filter((currentPost) => currentPost.id !== post.id)
      );
    },
    [user]
  );

  const handleRememberPost = useCallback(
    async (post, { fechaProgramada, canales }) =>
      crearRecordatorioPublicacion({
        publicacion: post,
        usuario: user,
        fechaProgramada,
        canales,
      }),
    [user]
  );

  const handleResolveFriendRequest = useCallback(
    async (request, action) => {
      try {
        if (action === 'aceptar') {
          await aceptarSolicitudAmistadPrincipal({ solicitud: request, usuario: user });
        } else {
          await eliminarSolicitudAmistadPrincipal({ solicitud: request, usuario: user });
        }

        await loadSocialData();
      } catch (error) {
        console.error(error);
        toast.error(error?.message || 'No se pudo responder la solicitud.');
      }
    },
    [loadSocialData, user]
  );

  const handleSendBirthdayMessage = useCallback(
    (friend, message = birthdayMessages[friend.id]) => {
      const cleanMessage = String(message || '').trim();
      const nextMessage = cleanMessage || getBirthdayDefaultMessage(friend);

      router.push(
        `${paths.dashboard.chat}?share=${encodeURIComponent(`${friend.nombre}: ${nextMessage}`)}`
      );
    },
    [birthdayMessages, router]
  );

  const handleChangeBirthdayMessage = useCallback((friendId, message) => {
    setBirthdayMessages((currentMessages) => ({
      ...currentMessages,
      [friendId]: message,
    }));
  }, []);

  const renderBirthdayPopover = () => (
    <Popover
      open={birthdayPopoverOpen}
      onClose={() => setBirthdayAnchorEl(null)}
      anchorReference="none"
      slotProps={{
        paper: {
          sx: {
            top: '50% !important',
            left: '50% !important',
            p: 2,
            position: 'fixed',
            width: { xs: 'calc(100vw - 32px)', sm: 680 },
            maxWidth: 1,
            maxHeight: '82vh',
            overflow: 'auto',
            transform: 'translate(-50%, -50%) !important',
          },
        },
      }}
    >
      <Stack divider={<Divider flexItem />} spacing={2}>
        {birthdayFriends.map((friend) => {
          const currentMessage = birthdayMessages[friend.id] || getBirthdayDefaultMessage(friend);

          return (
            <Stack key={friend.id} spacing={1.25}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar src={friend.urlFoto} alt={friend.nombre} sx={{ width: 56, height: 56 }} slotProps={{ img: { loading: 'lazy', decoding: 'async' } }} />

                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography noWrap variant="subtitle2" sx={{ flexGrow: 1 }}>
                      {friend.nombre}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {friend.edadCumplira} años
                    </Typography>
                  </Stack>

                  <TextField
                    fullWidth
                    size="small"
                    value={currentMessage}
                    placeholder={`Felicitar a ${friend.nombre}`}
                    onChange={(event) => handleChangeBirthdayMessage(friend.id, event.target.value)}
                    sx={{ mt: 0.75 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small">
                            <Iconify icon="eva:smiling-face-fill" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box sx={{ gap: 0.75, mt: 1, display: 'flex', flexWrap: 'wrap' }}>
                    {BIRTHDAY_PRESET_MESSAGES.map((message) => (
                      <Button
                        key={message}
                        size="small"
                        color="inherit"
                        variant="outlined"
                        onClick={() => handleChangeBirthdayMessage(friend.id, message)}
                        sx={{ borderRadius: 10, px: 1.25, fontWeight: 400 }}
                      >
                        {message}
                      </Button>
                    ))}
                  </Box>
                </Box>

                <IconButton
                  color="primary"
                  onClick={() => handleSendBirthdayMessage(friend, currentMessage)}
                  aria-label={`Enviar felicitación a ${friend.nombre}`}
                  sx={{ mt: 3.75 }}
                >
                  <Iconify icon="solar:plain-bold" width={28} />
                </IconButton>
              </Stack>
            </Stack>
          );
        })}

        <Stack spacing={1.5}>
          <Button
            fullWidth
            color="inherit"
            variant="text"
            onClick={() => setShowUpcomingBirthdays((current) => !current)}
          >
            {showUpcomingBirthdays ? 'Ocultar próximos cumpleaños' : 'Ver los próximos cumpleaños'}
          </Button>

          {showUpcomingBirthdays && (
            <Stack spacing={1}>
              {upcomingBirthdays.map((friend) => (
                <Stack
                  key={friend.id}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ p: 1, borderRadius: 1, bgcolor: 'background.neutral' }}
                >
                  <Avatar src={friend.urlFoto} alt={friend.nombre} slotProps={{ img: { loading: 'lazy', decoding: 'async' } }} />

                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography noWrap variant="subtitle2">
                      {friend.nombre}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {friend.fechaCumpleanosTexto}
                    </Typography>
                  </Box>

                  <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                    Cumple {friend.edadCumplira} años
                  </Typography>
                </Stack>
              ))}
              {!upcomingBirthdays.length && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No hay próximos cumpleaños de amigos aceptados.
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Popover>
  );

  const renderBirthdayFriends = () => {
    if (!birthdayFriends.length) return null;

    const [firstBirthdayFriend] = birthdayFriends;
    const extraCount = birthdayFriends.length - 1;
    const title =
      birthdayFriends.length === 1
        ? `Hoy cumple años ${firstBirthdayFriend.nombre}`
        : `Hoy cumple años ${firstBirthdayFriend.nombre} y ${extraCount} personas más`;

    return (
      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src={firstBirthdayFriend.urlFoto} alt={firstBirthdayFriend.nombre} slotProps={{ img: { loading: 'lazy', decoding: 'async' } }} />

            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="subtitle2">{title}</Typography>
              <Button
                size="small"
                color="inherit"
                sx={{ px: 0, minWidth: 0, color: 'text.secondary' }}
                onClick={(event) => setBirthdayAnchorEl(event.currentTarget)}
              >
                Ver más
              </Button>
            </Box>
          </Stack>

          <Button
            fullWidth
            size="small"
            variant="contained"
            onClick={(event) => setBirthdayAnchorEl(event.currentTarget)}
          >
            Enviar felicitaciones
          </Button>
        </Stack>
      </Card>
    );
  };

  const renderFriendRequests = () =>
    !!friendRequests.length && (
      <Stack spacing={1.5}>
        {friendRequests.map((request) => (
          <Card key={request.id} sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar src={request.urlFoto} alt={request.nombre}>
                  {request.nombre.charAt(0)}
                </Avatar>

                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography noWrap variant="subtitle2">
                    {request.nombre}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Solicitud de amistad
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  onClick={() => handleResolveFriendRequest(request, 'aceptar')}
                >
                  Aceptar
                </Button>
                <Button
                  fullWidth
                  size="small"
                  color="inherit"
                  variant="outlined"
                  onClick={() => handleResolveFriendRequest(request, 'eliminar')}
                >
                  Eliminar
                </Button>
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>
    );

  const renderAdsSlider = () => (
    <AppFeatured
      list={_appFeatured}
      imageSx={{ height: { xs: 288, md: 360 } }}
      sx={{ alignSelf: 'stretch' }}
    />
  );

  const renderPostInput = () => (
    <Card
      sx={{
        p: { xs: 2, sm: 3 },
        flexShrink: 0,
        border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Avatar src={user?.photoURL} alt={user?.displayName} sx={{ width: 44, height: 44 }}>
          {user?.displayName?.charAt(0).toUpperCase()}
        </Avatar>

        <InputBase
          multiline
          fullWidth
          minRows={2}
          maxRows={7}
          value={postMessage}
          onChange={handleChangePostMessage}
          placeholder="Comparte una novedad con la comunidad..."
          inputProps={{
            id: 'post-input',
            maxLength: PRINCIPAL_LIMITS.postMessage,
            'aria-label': 'Texto de la publicación',
          }}
          endAdornment={
            <InputAdornment position="end" sx={{ alignSelf: 'flex-start' }}>
              <IconButton
                aria-label="Agregar emoji"
                onClick={(event) => setEmojiAnchorEl(event.currentTarget)}
              >
                <Iconify icon="eva:smiling-face-fill" />
              </IconButton>
            </InputAdornment>
          }
          sx={[
            (theme) => ({
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'background.neutral',
              border: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
              '&:focus-within': {
                borderColor: 'primary.main',
                boxShadow: `0 0 0 3px ${varAlpha(theme.vars.palette.primary.mainChannel, 0.12)}`,
              },
            }),
          ]}
        />
      </Stack>

      <Typography
        variant="caption"
        sx={{ mt: 0.75, mb: 2, display: 'block', textAlign: 'right', color: 'text.disabled' }}
      >
        {postMessage.length.toLocaleString('es')} /{' '}
        {PRINCIPAL_LIMITS.postMessage.toLocaleString('es')}
      </Typography>

      {!!postImages.length && (
        <Box sx={{ gap: 1, mb: 3, display: 'flex', flexWrap: 'wrap' }}>
          {postImages.map((image) => (
            <Box
              key={image.id}
              sx={{
                p: 0.75,
                gap: 1,
                width: 160,
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
                src={image.previewUrl}
                alt={image.file.name}
                sx={{ width: 42, height: 42, borderRadius: 1, objectFit: 'cover' }}
              />
              <Typography noWrap variant="caption" sx={{ minWidth: 0, flexGrow: 1 }}>
                {image.file.name}
              </Typography>
              <IconButton size="small" onClick={() => handleRemoveImage(image.id)}>
                <Iconify icon="mingcute:close-line" width={16} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
          <Fab
            size="small"
            color="inherit"
            variant="softExtended"
            aria-label="Adjuntar fotos"
            onClick={handleAttach}
          >
            <Iconify icon="solar:gallery-wide-bold" width={24} sx={{ color: 'success.main' }} />
            Fotos
            <Box component="span" sx={{ ml: 0.75, color: 'text.secondary', typography: 'caption' }}>
              {postImages.length}/{MAX_POST_IMAGES}
            </Box>
          </Fab>
        </Box>

        <Button
          variant="contained"
          disabled={!postMessage.trim() && !postImages.length}
          onClick={handlePublishPost}
        >
          Publicar
        </Button>
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
        multiple
        ref={fileRef}
        type="file"
        accept={PRINCIPAL_IMAGE_ACCEPT}
        style={{ display: 'none' }}
        onChange={handleUploadImages}
      />
    </Card>
  );

  return (
    <Grid
      container
      spacing={3}
      sx={[
        MOBILE_EDGE_TO_EDGE_POSTS
          ? {
              mx: { xs: -2, sm: 0 },
              width: { xs: 'calc(100% + 32px)', sm: 1 },
            }
          : {},
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        role="status"
        aria-live="polite"
        data-pull-refresh-indicator
        sx={{
          top: 72,
          left: '50%',
          zIndex: 1400,
          gap: 1,
          px: 1.5,
          py: 1,
          display: { xs: 'flex', sm: 'none' },
          position: 'fixed',
          alignItems: 'center',
          borderRadius: 999,
          bgcolor: 'background.paper',
          boxShadow: (theme) => theme.vars.customShadows.z8,
          pointerEvents: 'none',
          opacity: pullRefreshDistance > 0 || refreshingByPull ? 1 : 0,
          transform: `translate(-50%, ${Math.min(0, pullRefreshDistance - PULL_REFRESH_THRESHOLD)}px)`,
          transition: pullRefreshDistance > 0 ? 'opacity 120ms ease' : 'all 180ms ease',
        }}
      >
        <CircularProgress
          size={22}
          variant={refreshingByPull ? 'indeterminate' : 'determinate'}
          value={Math.min(100, (pullRefreshDistance / PULL_REFRESH_THRESHOLD) * 100)}
        />
        <Typography variant="caption" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          {refreshingByPull
            ? 'Actualizando...'
            : pullRefreshDistance >= PULL_REFRESH_THRESHOLD
              ? 'Suelta para actualizar'
              : 'Hala para actualizar'}
        </Typography>
      </Box>

      <Grid
        size={{ xs: 12, md: 8 }}
        sx={{
          gap: 3,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          // Una foto servida desde cache puede conocer su altura antes del
          // primer pintado. Ninguna tarjeta debe encogerse para acomodar de
          // golpe la altura total del muro.
          '& > *': { flexShrink: 0 },
        }}
      >
        {canPublish && renderPostInput()}

        {loadingPosts &&
          Array.from({ length: 2 }, (_, index) => (
            <Card key={`post-skeleton-${index}`} sx={{ p: 3 }} aria-label="Cargando publicación">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Skeleton variant="circular" width={44} height={44} />
                <Box sx={{ flexGrow: 1 }}>
                  <Skeleton width="38%" />
                  <Skeleton width="24%" />
                </Box>
              </Stack>
              <Skeleton sx={{ mt: 2 }} />
              <Skeleton width="72%" />
              <Skeleton variant="rounded" height={260} sx={{ mt: 2 }} />
            </Card>
          ))}

        {!loadingPosts && !feedPosts.length && (
          <Card sx={{ p: 5, textAlign: 'center' }}>
            <Iconify
              icon="solar:posts-carousel-horizontal-bold-duotone"
              width={52}
              sx={{ color: 'text.disabled' }}
            />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Aún no hay publicaciones
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              Comparte la primera novedad con la comunidad.
            </Typography>
          </Card>
        )}

        {!loadingPosts &&
          feedPosts.map((post, index) => (
            <ProfilePostItem
              key={post.id}
              post={post}
              user={user}
              prioritizeImage={index === 0}
              edgeToEdgeMobile={MOBILE_EDGE_TO_EDGE_POSTS}
              onAddComment={handleAddComment}
              onToggleLike={handleToggleLike}
              onHidePost={handleHidePost}
              onUndoHidePost={handleUndoHidePost}
              onSharePost={handleSharePost}
              onReportPost={handleReportPost}
              onDeletePost={handleDeletePost}
              onRememberPost={handleRememberPost}
            />
          ))}

        {/* SE CARGA AL DESLIZAR, no al pulsar. Este bloque no pinta nada: es un
            centinela. Cuando entra en pantalla —200px antes, para que las
            siguientes ya esten cuando se llegue— pide la pagina siguiente. El
            boton se queda debajo como salida manual: si el observador no
            dispara (una pestaña en segundo plano, un navegador viejo), la gente
            no se queda sin poder seguir leyendo. */}
        {!loadingPosts && hasMorePosts && (
          <>
            {/* En `sx`, el numero 1 para `height` significa 100%, no 1px. Ese
                100% invisible encogia las tarjetas del flex y, como Card usa
                overflow hidden, terminaba cortando las fotos. */}
            <Box ref={centinelaPublicaciones} sx={{ height: '1px', flexShrink: 0 }} />

            {loadingMorePosts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Button
                fullWidth
                size="large"
                color="inherit"
                variant="outlined"
                onClick={handleLoadMorePosts}
              >
                Ver más publicaciones
              </Button>
            )}
          </>
        )}
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Stack
          spacing={3}
          sx={{
            top: 96,
            position: { md: 'sticky' },
            alignSelf: 'flex-start',
          }}
        >
          {renderFriendRequests()}
          {renderBirthdayFriends()}
          {renderAdsSlider()}
        </Stack>
      </Grid>
      {renderBirthdayPopover()}
    </Grid>
  );
}
