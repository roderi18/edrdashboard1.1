import { useRef, useState, useCallback } from 'react';
import { uuidv4, varAlpha } from 'minimal-shared/utils';

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

import { Iconify } from 'src/components/iconify';

import { AppFeatured } from 'src/sections/prinicipal/app/app-featured';

import { ProfilePostItem } from './profile-post-item';
import { ProfileEmojiPicker } from './profile-emoji-picker';

// ----------------------------------------------------------------------

export function ProfileHome({ info, posts, user, sx, ...other }) {
  const fileRef = useRef(null);
  const [feedPosts, setFeedPosts] = useState(posts);
  const [postMessage, setPostMessage] = useState('');
  const [postImages, setPostImages] = useState([]);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [emojiCategory, setEmojiCategory] = useState('Caras');

  const emojiPickerOpen = Boolean(emojiAnchorEl);

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

  const handlePublishPost = useCallback(() => {
    const nextMessage = postMessage.trim();
    const mediaItems = postImages.map((image) => image.previewUrl);

    if (!nextMessage && !mediaItems.length) return;

    setFeedPosts((currentPosts) => [
      {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        media: mediaItems[0] || '',
        mediaItems,
        message: nextMessage,
        personLikes: [],
        comments: [],
        isLikedByMe: false,
      },
      ...currentPosts,
    ]);
    setPostMessage('');
    setPostImages([]);
  }, [postImages, postMessage]);

  const handleHidePost = useCallback((postId) => {
    setFeedPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
  }, []);

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

        {feedPosts.map((post) => (
          <ProfilePostItem key={post.id} post={post} user={user} onHidePost={handleHidePost} />
        ))}
      </Grid>

      <Grid size={{ xs: 12, md: 4 }} sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
        {renderFollows()}
        {renderAdsSlider()}
      </Grid>
    </Grid>
  );
}
