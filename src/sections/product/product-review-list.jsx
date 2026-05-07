import Typography from '@mui/material/Typography';
import Pagination, { paginationClasses } from '@mui/material/Pagination';

import { ProductReviewItem } from './product-review-item';

// ----------------------------------------------------------------------

export function ProductReviewList({ reviews }) {
  if (!reviews.length) {
    return (
      <Typography variant="body2" sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
        Todavia no hay resenas para este producto.
      </Typography>
    );
  }

  return (
    <>
      {reviews.map((review) => (
        <ProductReviewItem key={review.id} review={review} />
      ))}

      <Pagination
        count={Math.max(1, Math.ceil(reviews.length / 5))}
        sx={{
          mx: 'auto',
          [`& .${paginationClasses.ul}`]: { my: 5, mx: 'auto', justifyContent: 'center' },
        }}
      />
    </>
  );
}
