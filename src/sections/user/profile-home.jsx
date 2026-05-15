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
import InputBase from '@mui/material/InputBase';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fNumber } from 'src/utils/format-number';

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

import { Iconify } from 'src/components/iconify';

import { AppFeatured } from 'src/sections/prinicipal/app/app-featured';

import { ProfilePostItem } from './profile-post-item';
import { ProfileEmojiPicker } from './profile-emoji-picker';

// ----------------------------------------------------------------------

const BIRTHDAY_PRESET_MESSAGES = [
  'Dios te bendiga, feliz cumpleaños. 🙏 🎉',
  'Que Dios te regale un año lleno de salud, gozo y paz. 🙌 🎂',
  'Feliz cumpleaños, que el Señor guíe cada paso de tu vida. ✨',
  'Bendiciones en tu día, que sigas creciendo con alegría. 🎁',
];

const getBirthdayDefaultMessage = (friend) =>
  `¡Feliz cumpleaños, ${friend.nombre}! Dios te bendiga en este nuevo año de vida. 🎉`;

export function ProfileHome({ info, posts, user, sx, ...other }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [feedPosts, setFeedPosts] = useState(posts);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [publishingPost, setPublishingPost] = useState(false);
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

  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const birthdayPopoverOpen = Boolean(birthdayAnchorEl);
  const usuarioIdMiembros = getPrincipalMemberId(user);
  const friendRequests = socialData.solicitudesAmistad;
  const birthdayFriends = socialData.cumpleanerosHoy;
  const upcomingBirthdays = socialData.proximosCumpleanos;

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
        const nextPosts = await obtenerPublicacionesPrincipal({
          usuarioIdMiembros,
          mocks: posts,
        });

        if (active) {
          setFeedPosts(nextPosts);
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
  }, [posts, usuarioIdMiembros]);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

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
    setPostMessage((currentMessage) => `${currentMessage}${emoji}`);
  }, []);

  const handleUploadImages = useCallback((event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    const imageFiles = files.filter((file) => String(file.type || '').startsWith('image/'));

    setPostImages((currentImages) => [
      ...currentImages,
      ...imageFiles.map((file, index) => ({
        id: `post-image-${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }, []);

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

    setPublishingPost(true);

    try {
      const nextPost = await crearPublicacionPrincipal({
        mensaje: nextMessage,
        imagenes: postImages,
        usuario: user,
      });

      setFeedPosts((currentPosts) => [nextPost, ...currentPosts]);
      setPostMessage('');
      postImages.forEach((image) => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
      setPostImages([]);
    } catch (error) {
      console.error(error);
    } finally {
      setPublishingPost(false);
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
          await eliminarSolicitudAmistadPrincipal({ solicitud: request });
        }

        await loadSocialData();
      } catch (error) {
        console.error(error);
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
                <Avatar src={friend.urlFoto} alt={friend.nombre} sx={{ width: 56, height: 56 }} />

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
                  <Avatar src={friend.urlFoto} alt={friend.nombre} />

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
            <Avatar src={firstBirthdayFriend.urlFoto} alt={firstBirthdayFriend.nombre} />

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

  const renderFollows = () => (
    <Card sx={{ py: 3, textAlign: 'center', typography: 'h4' }}>
      <Stack
        divider={<Divider orientation="vertical" flexItem sx={{ borderStyle: 'dashed' }} />}
        sx={{ flexDirection: 'row' }}
      >
        <Stack sx={{ width: 1 }}>
          {fNumber(info.totalFollowers)}
          <Box component="span" sx={{ color: 'text.secondary', typography: 'body2' }}>
            Seguidores
          </Box>
        </Stack>

        <Stack sx={{ width: 1 }}>
          {fNumber(info.totalFollowing)}
          <Box component="span" sx={{ color: 'text.secondary', typography: 'body2' }}>
            Siguiendo
          </Box>
        </Stack>
      </Stack>
    </Card>
  );

  const renderAdsSlider = () => (
    <AppFeatured
      list={_appFeatured}
      imageSx={{ height: { xs: 288, md: 360 } }}
      sx={{ alignSelf: 'stretch' }}
    />
  );

  const renderPostInput = () => (
    <Card sx={{ p: 3 }}>
      <InputBase
        multiline
        fullWidth
        rows={2}
        value={postMessage}
        onChange={handleChangePostMessage}
        placeholder="Comparte lo que estas pensando..."
        inputProps={{ id: 'post-input' }}
        endAdornment={
          <InputAdornment position="end" sx={{ alignSelf: 'flex-start' }}>
            <IconButton onClick={(event) => setEmojiAnchorEl(event.currentTarget)}>
              <Iconify icon="eva:smiling-face-fill" />
            </IconButton>
          </InputAdornment>
        }
        sx={[
          (theme) => ({
            p: 1.5,
            mb: 2,
            borderRadius: 1,
            border: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
          }),
        ]}
      />

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
          <Fab size="small" color="inherit" variant="softExtended" onClick={handleAttach}>
            <Iconify icon="solar:gallery-wide-bold" width={24} sx={{ color: 'success.main' }} />
            Fotos
          </Fab>
        </Box>

        <Button
          variant="contained"
          disabled={publishingPost || (!postMessage.trim() && !postImages.length)}
          onClick={handlePublishPost}
        >
          {publishingPost ? 'Publicando...' : 'Publicar'}
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
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUploadImages}
      />
    </Card>
  );

  return (
    <Grid container spacing={3} sx={sx} {...other}>
      <Grid size={{ xs: 12, md: 8 }} sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
        {renderPostInput()}

        {loadingPosts && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Cargando publicaciones...
          </Typography>
        )}

        {feedPosts.map((post) => (
          <ProfilePostItem
            key={post.id}
            post={post}
            user={user}
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
          {renderFollows()}
          {renderAdsSlider()}
        </Stack>
      </Grid>
      {renderBirthdayPopover()}
    </Grid>
  );
}
