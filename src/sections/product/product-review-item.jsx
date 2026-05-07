import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Rating from '@mui/material/Rating';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import ListItemText from '@mui/material/ListItemText';

import { fDate, fTime } from 'src/utils/format-time';
import { getProductReviewUserVote } from 'src/utils/product-reviews-storage';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function ProductReviewItem({ review, reviewer, highlighted, onVoteReview }) {
  const itemRef = useRef(null);
  const [showHighlight, setShowHighlight] = useState(false);
  const userVote = getProductReviewUserVote(review, reviewer);
  const reviewerRole = String(reviewer?.role ?? reviewer?.rol ?? '').toLowerCase();
  const isAdmin = ['admin', 'administrador', 'administrator'].includes(reviewerRole);

  useEffect(() => {
    if (!highlighted || !itemRef.current) return undefined;

    setShowHighlight(true);

    const scrollTimer = setTimeout(() => {
      itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    const highlightTimer = setTimeout(() => {
      setShowHighlight(false);
    }, 1500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(highlightTimer);
    };
  }, [highlighted]);

  const renderVoteButton = (vote, icon, count) => {
    const selected = userVote === vote;

    return (
      <ButtonBase
        disableRipple
        onClick={() => onVoteReview?.(review.id, vote)}
        sx={{
          gap: 0.5,
          typography: 'caption',
          color: selected ? 'primary.main' : 'text.primary',
        }}
      >
        <Iconify icon={selected ? icon.replace('outline', 'bold') : icon} width={16} />
        {count}
      </ButtonBase>
    );
  };

  const renderInfo = () => (
    <Box
      sx={{
        gap: 2,
        display: 'flex',
        width: { md: 240 },
        alignItems: 'center',
        textAlign: { md: 'center' },
        flexDirection: { xs: 'row', md: 'column' },
      }}
    >
      <Avatar
        src={review.avatarUrl}
        sx={{ width: { xs: 48, md: 64 }, height: { xs: 48, md: 64 } }}
      />

      <ListItemText
        primary={review.name}
        secondary={
          <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
            <Typography component="span" variant="caption" sx={{ display: 'block' }}>
              {fDate(review.postedAt)}
            </Typography>
            <Typography component="span" variant="caption" sx={{ display: 'block' }}>
              {fTime(review.postedAt)}
            </Typography>
          </Box>
        }
        slotProps={{
          primary: { noWrap: true },
          secondary: {
            component: 'span',
            sx: { display: 'block' },
          },
        }}
      />
    </Box>
  );

  const renderContent = () => (
    <Box
      sx={{
        gap: 1,
        display: 'flex',
        flex: '1 1 auto',
        flexDirection: 'column',
      }}
    >
      <Rating size="small" value={review.rating} precision={0.1} readOnly />

      {review.isPurchased && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'success.main',
            typography: 'caption',
          }}
        >
          <Iconify icon="solar:verified-check-bold" width={16} sx={{ mr: 0.5 }} />
          Compra verificada
        </Box>
      )}

      <Typography variant="body2">{review.comment}</Typography>

      {isAdmin && (
        <Button
          size="small"
          variant="soft"
          color="inherit"
          startIcon={<Iconify icon="solar:reply-bold" />}
          sx={{ alignSelf: 'flex-start', mt: 0.5 }}
        >
          Responder
        </Button>
      )}

      {!!review.attachments?.length && (
        <Box
          sx={{
            pt: 1,
            gap: 1,
            display: 'flex',
            flexWrap: 'wrap',
          }}
        >
          {review.attachments.map((attachment) => (
            <Box
              key={attachment}
              component="img"
              alt={attachment}
              src={attachment}
              sx={{ width: 64, height: 64, borderRadius: 1.5 }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ gap: 2, pt: 1.5, display: 'flex' }}>
        {renderVoteButton('helpful', 'solar:like-outline', review.helpfulCount ?? 0)}
        {renderVoteButton('unhelpful', 'solar:dislike-outline', review.unhelpfulCount ?? 0)}
      </Box>
    </Box>
  );

  return (
    <Box
      id={`review-${review.id}`}
      ref={itemRef}
      sx={{
        mt: 5,
        gap: 2,
        display: 'flex',
        py: showHighlight ? 2 : 0,
        px: { xs: 2.5, md: 0 },
        outline: showHighlight ? '2px solid' : '0 solid transparent',
        borderRadius: 1,
        outlineColor: showHighlight ? 'warning.main' : 'transparent',
        bgcolor: showHighlight ? 'warning.lighter' : 'transparent',
        flexDirection: { xs: 'column', md: 'row' },
        scrollMarginTop: 120,
        transition: (theme) =>
          theme.transitions.create(['background-color', 'outline-color', 'padding'], {
            duration: showHighlight ? theme.transitions.duration.shorter : 600,
          }),
      }}
    >
      {renderInfo()}
      {renderContent()}
    </Box>
  );
}
