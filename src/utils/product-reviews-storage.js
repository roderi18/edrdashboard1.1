const PRODUCT_REVIEWS_KEY = 'dashboard-product-reviews';
const PRODUCT_REVIEW_VOTER_KEY = 'dashboard-product-review-voter';

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

const buildVoterId = (user = {}) => {
  const voterId =
    user.uid ||
    user.id ||
    user.email ||
    user.displayName ||
    [user.nombres, user.apellidos].filter(Boolean).join(' ').trim() ||
    user.name;

  if (voterId) return String(voterId);

  if (typeof window === 'undefined') return 'anonimo';

  const storedVoterId = window.localStorage.getItem(PRODUCT_REVIEW_VOTER_KEY);
  if (storedVoterId) return storedVoterId;

  const nextVoterId = buildReviewId();
  window.localStorage.setItem(PRODUCT_REVIEW_VOTER_KEY, nextVoterId);

  return nextVoterId;
};

const normalizeVotes = (votes) =>
  votes && typeof votes === 'object' && !Array.isArray(votes) ? votes : {};

const buildReplyAuthorName = (user = {}) =>
  user.displayName ||
  user.nombre ||
  [user.nombres, user.apellidos].filter(Boolean).join(' ').trim() ||
  user.name ||
  user.email ||
  'Administrador';

const normalizeReplies = (replies) =>
  Array.isArray(replies)
    ? replies.map((reply) => ({
        id: reply.id || buildReviewId(),
        message: reply.message || reply.text || '',
        authorId: String(reply.authorId || ''),
        authorName: reply.authorName || 'Administrador',
        createdAt: reply.createdAt || new Date().toISOString(),
      }))
    : [];

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
  votes: normalizeVotes(review.votes),
  replies: normalizeReplies(review.replies),
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

  [...normalizedReviews, ...storedReviews].forEach((review) => {
    reviewById.set(String(review.id), review);
  });

  return Array.from(reviewById.values()).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
};

export const updateStoredProductReviewVote = (productId, reviewId, user, vote, baseReviews = []) => {
  const key = String(productId);
  const voterId = buildVoterId(user);
  const reviewsByProduct = readStorage();
  const reviews = Array.isArray(reviewsByProduct[key]) && reviewsByProduct[key].length
    ? reviewsByProduct[key]
    : baseReviews;

  const nextReviews = reviews.map((review) => {
    if (String(review.id) !== String(reviewId)) return review;

    const normalizedReview = normalizeProductReview(review);
    const votes = { ...normalizedReview.votes };
    const previousVote = votes[voterId];
    const nextVote = previousVote === vote ? null : vote;
    const helpfulCount = normalizedReview.helpfulCount
      - (previousVote === 'helpful' ? 1 : 0)
      + (nextVote === 'helpful' ? 1 : 0);
    const unhelpfulCount =
      normalizedReview.unhelpfulCount -
      (previousVote === 'unhelpful' ? 1 : 0) +
      (nextVote === 'unhelpful' ? 1 : 0);

    if (nextVote) {
      votes[voterId] = nextVote;
    } else {
      delete votes[voterId];
    }

    return {
      ...normalizedReview,
      votes,
      helpfulCount: Math.max(0, helpfulCount),
      unhelpfulCount: Math.max(0, unhelpfulCount),
    };
  });

  writeStorage({ ...reviewsByProduct, [key]: nextReviews });

  return nextReviews.map(normalizeProductReview);
};

export const getProductReviewUserVote = (review = {}, user = {}) => {
  const voterId = buildVoterId(user);

  return normalizeVotes(review.votes)[voterId] || null;
};

export const addStoredProductReviewReply = (
  productId,
  reviewId,
  reply = {},
  user = {},
  baseReviews = []
) => {
  const key = String(productId);
  const reviewsByProduct = readStorage();
  const reviews =
    Array.isArray(reviewsByProduct[key]) && reviewsByProduct[key].length
      ? reviewsByProduct[key]
      : baseReviews;
  const nextReply = {
    id: buildReviewId(),
    message: String(reply.message || reply.text || '').trim(),
    authorId: String(user.uid || user.id || user.email || ''),
    authorName: buildReplyAuthorName(user),
    createdAt: new Date().toISOString(),
  };

  if (!nextReply.message) return reviews.map(normalizeProductReview);

  const nextReviews = reviews.map((review) => {
    if (String(review.id) !== String(reviewId)) return review;

    const normalizedReview = normalizeProductReview(review);

    return {
      ...normalizedReview,
      replies: [...normalizedReview.replies, nextReply],
    };
  });

  writeStorage({ ...reviewsByProduct, [key]: nextReviews });

  return nextReviews.map(normalizeProductReview);
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
