import {
  doc,
  query,
  where,
  setDoc,
  getDocs,
  collection,
} from 'firebase/firestore';

import {
  ahoraTimestamp,
  timestampToIsoString,
  COLECCIONES_COMERCIO,
  sanitizarFirestoreData,
} from 'src/utils/firestore-commerce';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

const clampRating = (value) => Math.min(5, Math.max(1, Number(value) || 0));

const buildReviewId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `resena-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

  return voterId ? String(voterId) : 'anonimo';
};

const buildReplyAuthorName = (user = {}) =>
  user.displayName ||
  user.nombre ||
  [user.nombres, user.apellidos].filter(Boolean).join(' ').trim() ||
  user.name ||
  user.email ||
  'Administrador';

const normalizeVotes = (votes) =>
  votes && typeof votes === 'object' && !Array.isArray(votes) ? votes : {};

const normalizeReplies = (replies) =>
  Array.isArray(replies)
    ? replies.map((reply) => ({
        id: reply.id || buildReviewId(),
        message: reply.message || reply.mensaje || reply.text || '',
        authorId: String(reply.authorId || reply.autorId || ''),
        authorName: reply.authorName || reply.autorNombre || 'Administrador',
        createdAt: reply.createdAt || timestampToIsoString(reply.creadoEn) || new Date().toISOString(),
      }))
    : [];

const getReviewCreatedAt = (review = {}) =>
  review.postedAt || timestampToIsoString(review.publicadoEn) || new Date().toISOString();

const getReviewDocId = (productId, reviewId) =>
  `${String(productId).replace(/[/.]/g, '_')}_${String(reviewId).replace(/[/.]/g, '_')}`;

const reviewCollection = () => collection(FIRESTORE, COLECCIONES_COMERCIO.resenasProductos);

const reviewToFirestore = ({ productId, review = {}, user = {} }) => {
  const normalizedReview = normalizeProductReview(review, user);

  return sanitizarFirestoreData({
    productoId: String(productId),
    resenaId: normalizedReview.id,
    nombre: normalizedReview.name,
    correo: normalizedReview.email,
    calificacion: normalizedReview.rating,
    comentario: normalizedReview.comment,
    publicadoEn: normalizedReview.postedAt,
    avatarUrl: normalizedReview.avatarUrl,
    comprado: normalizedReview.isPurchased,
    adjuntos: normalizedReview.attachments,
    utilCount: normalizedReview.helpfulCount,
    noUtilCount: normalizedReview.unhelpfulCount,
    votos: normalizedReview.votes,
    respuestas: normalizedReview.replies.map((reply) => ({
      id: reply.id,
      mensaje: reply.message,
      autorId: reply.authorId,
      autorNombre: reply.authorName,
      creadoEn: reply.createdAt,
    })),
    actualizadoEn: ahoraTimestamp(),
  });
};

const firestoreToReview = (item = {}) =>
  normalizeProductReview({
    id: item.resenaId || item.id,
    name: item.nombre,
    email: item.correo,
    rating: item.calificacion,
    comment: item.comentario,
    postedAt: getReviewCreatedAt(item),
    avatarUrl: item.avatarUrl,
    isPurchased: item.comprado,
    attachments: item.adjuntos,
    helpfulCount: item.utilCount,
    unhelpfulCount: item.noUtilCount,
    votes: item.votos,
    replies: item.respuestas,
  });

const mergeReviews = (baseReviews = [], firestoreReviews = []) => {
  const reviewById = new Map();

  [...baseReviews.map(normalizeProductReview), ...firestoreReviews.map(normalizeProductReview)].forEach(
    (review) => {
      reviewById.set(String(review.id), review);
    }
  );

  return Array.from(reviewById.values()).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
};

const actualizarResumenProducto = async (productId, reviews = []) => {
  if (!isFirebaseConfigured || !FIRESTORE || !productId) return;

  const stats = buildProductReviewStats(reviews);

  await setDoc(
    doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(productId)),
    {
      totalCalificaciones: stats.totalRatings,
      totalResenas: stats.totalReviews,
      fechaActualizacion: ahoraTimestamp(),
    },
    { merge: true }
  );
};

export const normalizeProductReview = (review = {}, user = {}) => ({
  id: review.id || review.resenaId || buildReviewId(),
  name: buildReviewerName(review, user),
  email: review.email || review.correo || user.email || '',
  rating: clampRating(review.rating ?? review.calificacion),
  comment: review.comment ?? review.comentario ?? review.review ?? '',
  postedAt: getReviewCreatedAt(review),
  avatarUrl: review.avatarUrl || user.photoURL || user.avatarUrl || '',
  isPurchased: Boolean(review.isPurchased ?? review.comprado),
  attachments: Array.isArray(review.attachments ?? review.adjuntos)
    ? review.attachments || review.adjuntos
    : [],
  helpfulCount: Number(review.helpfulCount ?? review.utilCount ?? review.likes ?? 0),
  unhelpfulCount: Number(review.unhelpfulCount ?? review.noUtilCount ?? review.dislikes ?? 0),
  votes: normalizeVotes(review.votes ?? review.votos),
  replies: normalizeReplies(review.replies ?? review.respuestas),
});

export const listarResenasProductoFirestore = async (productId, baseReviews = []) => {
  if (!productId) return [];

  if (!isFirebaseConfigured || !FIRESTORE) {
    return mergeReviews(baseReviews, []);
  }

  const snapshot = await getDocs(
    query(reviewCollection(), where('productoId', '==', String(productId)))
  );
  const firestoreReviews = snapshot.docs.map((item) =>
    firestoreToReview({ id: item.id, ...item.data() })
  );

  return mergeReviews(baseReviews, firestoreReviews);
};

export const crearResenaProductoFirestore = async (productId, review, user) => {
  const nextReview = normalizeProductReview(review, user);

  if (!productId || !isFirebaseConfigured || !FIRESTORE) {
    return nextReview;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_COMERCIO.resenasProductos, getReviewDocId(productId, nextReview.id)),
    reviewToFirestore({ productId, review: nextReview, user })
  );

  const nextReviews = await listarResenasProductoFirestore(productId);
  await actualizarResumenProducto(productId, nextReviews);

  return nextReview;
};

export const actualizarVotoResenaProductoFirestore = async (
  productId,
  reviewId,
  user,
  vote,
  baseReviews = []
) => {
  const voterId = buildVoterId(user);
  const reviews = await listarResenasProductoFirestore(productId, baseReviews);
  const nextReviews = reviews.map((review) => {
    if (String(review.id) !== String(reviewId)) return review;

    const votes = { ...normalizeVotes(review.votes) };
    const previousVote = votes[voterId];
    const nextVote = previousVote === vote ? null : vote;
    const helpfulCount =
      review.helpfulCount - (previousVote === 'helpful' ? 1 : 0) + (nextVote === 'helpful' ? 1 : 0);
    const unhelpfulCount =
      review.unhelpfulCount -
      (previousVote === 'unhelpful' ? 1 : 0) +
      (nextVote === 'unhelpful' ? 1 : 0);

    if (nextVote) {
      votes[voterId] = nextVote;
    } else {
      delete votes[voterId];
    }

    return {
      ...review,
      votes,
      helpfulCount: Math.max(0, helpfulCount),
      unhelpfulCount: Math.max(0, unhelpfulCount),
    };
  });
  const updatedReview = nextReviews.find((review) => String(review.id) === String(reviewId));

  if (updatedReview && productId && isFirebaseConfigured && FIRESTORE) {
    await setDoc(
      doc(FIRESTORE, COLECCIONES_COMERCIO.resenasProductos, getReviewDocId(productId, reviewId)),
      reviewToFirestore({ productId, review: updatedReview }),
      { merge: true }
    );
    await actualizarResumenProducto(productId, nextReviews);
  }

  return nextReviews;
};

export const responderResenaProductoFirestore = async (
  productId,
  reviewId,
  reply = {},
  user = {},
  baseReviews = []
) => {
  const message = String(reply.message || reply.text || '').trim();
  const reviews = await listarResenasProductoFirestore(productId, baseReviews);

  if (!message) return reviews;

  const nextReply = {
    id: buildReviewId(),
    message,
    authorId: String(user.uid || user.id || user.email || ''),
    authorName: buildReplyAuthorName(user),
    createdAt: new Date().toISOString(),
  };
  const nextReviews = reviews.map((review) =>
    String(review.id) === String(reviewId)
      ? { ...review, replies: [...review.replies, nextReply] }
      : review
  );
  const updatedReview = nextReviews.find((review) => String(review.id) === String(reviewId));

  if (updatedReview && productId && isFirebaseConfigured && FIRESTORE) {
    await setDoc(
      doc(FIRESTORE, COLECCIONES_COMERCIO.resenasProductos, getReviewDocId(productId, reviewId)),
      reviewToFirestore({ productId, review: updatedReview }),
      { merge: true }
    );
    await actualizarResumenProducto(productId, nextReviews);
  }

  return nextReviews;
};

export const getProductReviewUserVote = (review = {}, user = {}) => {
  const voterId = buildVoterId(user);

  return normalizeVotes(review.votes)[voterId] || null;
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
