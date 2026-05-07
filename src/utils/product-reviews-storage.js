const PRODUCT_REVIEWS_KEY = 'dashboard-product-reviews';

const clampRating = (value) => Math.min(5, Math.max(1, Number(value) || 0));

const readStorage = () => {
  if (typeof window === 'undefined') return {};

  try {
    return JSON.parse(window.localStorage.getItem(PRODUCT_REVIEWS_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeStorage = (value) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(PRODUCT_REVIEWS_KEY, JSON.stringify(value));
};

const buildReviewId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const buildReviewerName = (review = {}, user = {}) =>
  review.name ||
  user.displayName ||
  user.nombre ||
  [user.nombres, user.apellidos].filter(Boolean).join(' ').trim() ||
  user.name ||
  user.email ||
  'Usuario';

export const normalizeProductReview = (review = {}, user = {}) => ({
  id: review.id || buildReviewId(),
  name: buildReviewerName(review, user),
  email: review.email || user.email || '',
  rating: clampRating(review.rating),
  comment: review.comment ?? review.review ?? '',
  postedAt: review.postedAt || new Date().toISOString(),
  avatarUrl: review.avatarUrl || user.photoURL || user.avatarUrl || '',
  isPurchased: Boolean(review.isPurchased),
  attachments: Array.isArray(review.attachments) ? review.attachments : [],
  helpfulCount: Number(review.helpfulCount ?? review.likes ?? 0),
  unhelpfulCount: Number(review.unhelpfulCount ?? review.dislikes ?? 0),
});

export const getStoredProductReviews = (productId) => {
  if (!productId) return [];

  const reviewsByProduct = readStorage();
  const reviews = reviewsByProduct[String(productId)];

  return Array.isArray(reviews) ? reviews.map(normalizeProductReview) : [];
};

export const addStoredProductReview = (productId, review, user) => {
  if (!productId) return normalizeProductReview(review, user);

  const reviewsByProduct = readStorage();
  const key = String(productId);
  const nextReview = normalizeProductReview(review, user);
  const nextReviews = [nextReview, ...(Array.isArray(reviewsByProduct[key]) ? reviewsByProduct[key] : [])];

  writeStorage({ ...reviewsByProduct, [key]: nextReviews });

  return nextReview;
};

export const mergeProductReviews = (productId, reviews = []) => {
  const normalizedReviews = reviews.map(normalizeProductReview);
  const storedReviews = getStoredProductReviews(productId);
  const reviewById = new Map();

  [...storedReviews, ...normalizedReviews].forEach((review) => {
    reviewById.set(String(review.id), review);
  });

  return Array.from(reviewById.values()).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
};

export const buildProductReviewStats = (reviews = []) => {
  const normalizedReviews = reviews.map(normalizeProductReview);
  const totalReviews = normalizedReviews.length;
  const totalRatings = totalReviews
    ? Number(
        (
          normalizedReviews.reduce((sum, review) => sum + clampRating(review.rating), 0) /
          totalReviews
        ).toFixed(1)
      )
    : 0;

  const ratings = [1, 2, 3, 4, 5].map((star) => {
    const reviewCount = normalizedReviews.filter(
      (review) => Math.round(clampRating(review.rating)) === star
    ).length;

    return {
      name: `${star} ${star === 1 ? 'estrella' : 'estrellas'}`,
      starCount: reviewCount,
      reviewCount,
    };
  });

  return { ratings, totalRatings, totalReviews };
};
