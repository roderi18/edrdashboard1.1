import { varAlpha } from 'minimal-shared/utils';
import { useRef, useState, useEffect, useCallback } from 'react';

import Fab from '@mui/material/Fab';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { fNumber } from 'src/utils/format-number';

import { _appFeatured } from 'src/_mock';
import {
  getPrincipalMemberId,
  crearPublicacionPrincipal,
  crearComentarioPublicacion,
  alternarReaccionPublicacion,
  registrarReportePublicacion,
  ocultarPublicacionPrincipal,
  obtenerPublicacionesPrincipal,
  registrarCompartidoPublicacion,
  deshacerOcultarPublicacionPrincipal,
} from 'src/services/principal-service';

import { Iconify } from 'src/components/iconify';

import { AppFeatured } from 'src/sections/prinicipal/app/app-featured';

import { ProfilePostItem } from './profile-post-item';
import { ProfileEmojiPicker } from './profile-emoji-picker';

// ----------------------------------------------------------------------

export function ProfileHome({ info, posts, user, sx, ...other }) {
  const fileRef = useRef(null);
  const [feedPosts, setFeedPosts] = useState(posts);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [publishingPost, setPublishingPost] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [postImages, setPostImages] = useState([]);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [emojiCategory, setEmojiCategory] = useState('Caras');

  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const usuarioIdMiembros = getPrincipalMemberId(user);

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
    async (post, { mensaje, imagen }) => {
      const nextComment = await crearComentarioPublicacion({
        idPublicacion: post.id,
        mensaje,
        imagen,
        usuario: user,
      });

      setFeedPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                comments: [...(currentPost.comments || []), nextComment],
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
        rows={4}
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
            p: 2,
            mb: 3,
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
            Imagen/Video
          </Fab>
          <Fab size="small" color="inherit" variant="softExtended">
            <Iconify icon="solar:videocamera-record-bold" width={24} sx={{ color: 'error.main' }} />
            En vivo
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
          />
        ))}
      </Grid>

      <Grid size={{ xs: 12, md: 4 }} sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
        {renderFollows()}
        {renderAdsSlider()}
      </Grid>
    </Grid>
  );
}
