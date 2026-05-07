import { sumBy } from 'es-toolkit';
import { useBoolean } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { fShortenNumber } from 'src/utils/format-number';
import {
  mergeProductReviews,
  addStoredProductReview,
  buildProductReviewStats,
} from 'src/utils/product-reviews-storage';

import { Iconify } from 'src/components/iconify';

import { ProductReviewList } from './product-review-list';
import { ProductReviewCreateForm } from './product-review-create-form';

// ----------------------------------------------------------------------

export function ProductDetailsReview({
  productId,
  reviews = [],
  reviewer,
  onReviewsChange,
}) {
  const review = useBoolean();
  const [currentReviews, setCurrentReviews] = useState([]);

  useEffect(() => {
    const mergedReviews = mergeProductReviews(productId, reviews);

    setCurrentReviews(mergedReviews);

    if (productId && mergedReviews.length !== reviews.length) {
      onReviewsChange?.(mergedReviews);
    }
  }, [onReviewsChange, productId, reviews]);

  const stats = useMemo(() => buildProductReviewStats(currentReviews), [currentReviews]);

  const displayRatings = stats.ratings;
  const totalReviews = stats.totalReviews;
  const totalRatings = stats.totalRatings;
  const total = sumBy(displayRatings, (star) => star.starCount);

  const handleCreateReview = useCallback(
    async (data) => {
      const nextReview = addStoredProductReview(productId, data, reviewer);
      const nextReviews = [nextReview, ...currentReviews];

      setCurrentReviews(nextReviews);
      onReviewsChange?.(nextReviews);
    },
    [currentReviews, onReviewsChange, productId, reviewer]
  );

  const renderSummary = () => (
    <Stack spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="subtitle2">Calificacion promedio</Typography>

      <Typography variant="h2">
        {totalRatings}
        /5
      </Typography>

      <Rating readOnly value={totalRatings} precision={0.1} />

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        ({fShortenNumber(totalReviews)} {totalReviews === 1 ? 'resena' : 'resenas'})
      </Typography>
    </Stack>
  );

  const renderProgress = () => (
    <Stack
      spacing={1.5}
      sx={[
        (theme) => ({
          py: 5,
          px: { xs: 3, md: 5 },
          borderLeft: { md: `dashed 1px ${theme.vars.palette.divider}` },
          borderRight: { md: `dashed 1px ${theme.vars.palette.divider}` },
        }),
      ]}
    >
      {displayRatings
        .slice(0)
        .reverse()
        .map((rating) => (
          <Box key={rating.name} sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle2" component="span" sx={{ width: 96, flexShrink: 0 }}>
              {rating.name}
            </Typography>

            <LinearProgress
              color="inherit"
              variant="determinate"
              value={total ? (rating.starCount / total) * 100 : 0}
              sx={{ mx: 2, flexGrow: 1 }}
            />

            <Typography
              variant="body2"
              component="span"
              sx={{ minWidth: 64, pl: 1, color: 'text.secondary' }}
            >
              {fShortenNumber(rating.reviewCount)}
            </Typography>
          </Box>
        ))}
    </Stack>
  );

  const renderReviewButton = () => (
    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <Button
        size="large"
        variant="soft"
        color="inherit"
        onClick={review.onTrue}
        startIcon={<Iconify icon="solar:pen-bold" />}
      >
        Escribir resena
      </Button>
    </Stack>
  );

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          py: { xs: 5, md: 0 },
          gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: '0.85fr 1.45fr 0.7fr' },
        }}
      >
        {renderSummary()}
        {renderProgress()}
        {renderReviewButton()}
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />
      <ProductReviewList reviews={currentReviews} />
      <ProductReviewCreateForm
        open={review.value}
        onClose={review.onFalse}
        onCreateReview={handleCreateReview}
      />
    </>
  );
}
