import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';

import { CHAT_EMOJI_CATEGORIES } from 'src/sections/chat/chat-message-input';

// ----------------------------------------------------------------------

export function ProfileEmojiPicker({
  open,
  anchorEl,
  onClose,
  emojiCategory,
  onChangeCategory,
  onSelectEmoji,
}) {
  const currentEmojiCategory =
    CHAT_EMOJI_CATEGORIES.find((category) => category.label === emojiCategory) ||
    CHAT_EMOJI_CATEGORIES[0];

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)', borderRadius: 1.5 } },
      }}
    >
      <Box sx={{ p: 1 }}>
        <Box sx={{ gap: 0.5, mb: 1, display: 'flex', overflowX: 'auto' }}>
          {CHAT_EMOJI_CATEGORIES.map((category) => (
            <Box
              key={category.label}
              component="button"
              type="button"
              onClick={() => onChangeCategory(category.label)}
              sx={{
                px: 1,
                py: 0.5,
                border: 0,
                borderRadius: 1,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                typography: 'caption',
                color: emojiCategory === category.label ? 'primary.contrastText' : 'text.primary',
                bgcolor: emojiCategory === category.label ? 'primary.main' : 'background.neutral',
              }}
            >
              {category.label}
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            gap: 0.25,
            display: 'grid',
            maxHeight: 260,
            overflowY: 'auto',
            gridTemplateColumns: 'repeat(8, 1fr)',
          }}
        >
          {currentEmojiCategory.emojis.map((emoji, index) => (
            <IconButton
              key={`${emoji}-${index}`}
              size="small"
              onClick={() => onSelectEmoji(emoji)}
              sx={{ width: 38, height: 38, fontSize: 22 }}
            >
              {emoji}
            </IconButton>
          ))}
        </Box>
      </Box>
    </Popover>
  );
}
