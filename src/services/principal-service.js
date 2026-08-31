import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import {
  doc,
  query,
  limit,
  where,
  setDoc,
  getDoc,
  orderBy,
  getDocs,
  deleteDoc,
  increment,
  updateDoc,
  collection,
  startAfter,
  writeBatch,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { optimizeImageFile } from 'src/utils/image-optimizer';
import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';
import { validatePrincipalImages, validatePrincipalMessage } from 'src/utils/principal-content';

import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';
import { resolverNotificacionConConfiguracion } from 'src/services/notification-service';

// ----------------------------------------------------------------------

export const COLECCIONES_PRINCIPAL = {
  publicaciones: 'publicaciones',
  comentarios: 'comentarios_publicaciones',
  reacciones: 'reacciones_publicaciones',
  reportes: 'reportes_publicaciones',
  ocultas: 'publicaciones_ocultas',
  compartidos: 'compartidos_publicaciones',
  seguidores: 'seguidores',
  amistades: 'amistades',
  galeria: 'galeria_usuarios',
  anuncios: 'anuncios_principal',
};

const ESTADO_ACTIVO = 'activo';
const VISIBILIDAD_PUBLICA = 'publico';
const COLECCIONES_USUARIOS_NOTIFICACIONES = ['users', 'usuarios_roles', 'admins'];
const PRINCIPAL_PAGE_SIZE = 10;

const createId = (prefix) =>
  `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

const toNumberOrNull = (value) => {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
};

const toIso = (value) => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();

  return new Date(value).toISOString();
};

const cleanFirestoreData = (value) => {
  if (Array.isArray(value)) {
    return value.map(cleanFirestoreData).filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);

    if (prototype && prototype !== Object.prototype) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, cleanFirestoreData(item)])
        .filter(([, item]) => item !== undefined)
    );
  }

  return value === undefined ? null : value;
};

const guardarNotificacionConfigurada = async (notificacion) => {
  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacionConfigurada.id),
    cleanFirestoreData(notificacionConfigurada),
    { merge: true }
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notificaciones:actualizar'));
  }

  return notificacionConfigurada;
};

export const getPrincipalMemberId = (user = {}) =>
  toNumberOrNull(user?.idMiembros) ||
  toNumberOrNull(user?.miembroId) ||
  toNumberOrNull(user?.idMiembro);

const assertPrincipalIdentity = (user = {}) => {
  if (!isFirebaseConfigured) return;

  if (!user?.uid || !getPrincipalMemberId(user)) {
    throw new Error('Tu sesión no tiene una identidad de miembro válida. Vuelve a iniciar sesión.');
  }
};

const getCodigoMiembro = (user = {}) =>
  user?.codigoMiembro || user?.codigoUsuario || user?.codigo || user?.memberId || '';

const getFileExtension = (file = {}) => {
  const nameExtension = String(file?.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();

  if (nameExtension && nameExtension !== file?.name) return nameExtension;
  if (file?.type === 'image/png') return 'png';
  if (file?.type === 'image/jpeg') return 'jpg';
  if (file?.type === 'image/gif') return 'gif';
  if (file?.type === 'image/webp') return 'webp';
  if (file?.type === 'image/svg+xml') return 'svg';

  return 'jpg';
};

const getUserName = (user = {}) =>
  user?.displayName ||
  user?.nombre ||
  user?.name ||
  [user?.nombres, user?.apellidos].filter(Boolean).join(' ').trim() ||
  user?.email ||
  user?.correo ||
  'Usuario';

const getUserPhoto = (user = {}) => user?.photoURL || user?.avatarUrl || user?.urlFoto || '';

const getUserDestacamentoId = (user = {}) =>
  toNumberOrNull(user?.idDestacamento) ||
  toNumberOrNull(user?.destId) ||
  toNumberOrNull(user?.alcance?.destacamentos?.[0]);

const getUserDestacamentoName = (user = {}) =>
  user?.nombreDestacamento || user?.destacamentoName || user?.destName || user?.destacamento || '';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildAuthorFields = (user = {}) => ({
  uidAutor: user?.uid || '',
  autorIdMiembros: getPrincipalMemberId(user),
  codigoMiembroAutor: getCodigoMiembro(user),
  correoAutor: user?.correo || user?.email || '',
  nombreAutor: getUserName(user),
  fotoAutorURL: getUserPhoto(user),
  idDestacamentoAutor: getUserDestacamentoId(user),
  nombreDestacamentoAutor: getUserDestacamentoName(user),
});

const buildUserFields = (user = {}, prefix = 'usuario') => ({
  [`uid${prefix[0].toUpperCase()}${prefix.slice(1)}`]: user?.uid || '',
  [`${prefix}IdMiembros`]: getPrincipalMemberId(user),
  [`codigoMiembro${prefix[0].toUpperCase()}${prefix.slice(1)}`]: getCodigoMiembro(user),
  [`correo${prefix[0].toUpperCase()}${prefix.slice(1)}`]: user?.correo || user?.email || '',
  [`nombre${prefix[0].toUpperCase()}${prefix.slice(1)}`]: getUserName(user),
  [`foto${prefix[0].toUpperCase()}${prefix.slice(1)}URL`]: getUserPhoto(user),
});

const getUserReactionDocId = ({ idPublicacion, user }) =>
  `${idPublicacion}_${getPrincipalMemberId(user) || user?.uid || user?.email || 'anonimo'}`;

const uploadPrincipalImages = async ({
  idPublicacion,
  imagenes = [],
  tipo = 'publicacion',
  usuario = {},
}) => {
  if (!imagenes.length) return [];

  validatePrincipalImages(imagenes);

  if (!isFirebaseConfigured || !FIREBASE_STORAGE) {
    return imagenes.map((image, index) => ({
      url: image.previewUrl || '',
      rutaArchivo: '',
      tipoArchivo: 'imagen',
      nombreArchivo: image.file?.name || `imagen-${index + 1}`,
      tamanoBytes: image.file?.size || 0,
      orden: index,
      local: true,
    }));
  }

  const files = imagenes.map((image) => image.file || image).filter(Boolean);
  const uploadResults = await Promise.allSettled(
    files.map(async (file, index) => {
      // LA FOTO SE OPTIMIZA ANTES DE SUBIR.
      //
      // Se subia el archivo tal cual sale de la camara —`calidadOriginal`— y se
      // han medido publicaciones de 11,6 MB. Quien abre el muro se las descarga
      // enteras para verlas en una tarjeta de 600px: cuatro fotos asi eran 25 de
      // los 27 MB que pesaba el panel, y una tardaba 9 segundos en llegar.
      //
      // Si la optimizacion falla —un formato que el navegador no sabe dibujar—
      // se sube el original: mejor pesado que perdido.
      const optimizado = await optimizeImageFile(file, 'publicacion').catch(() => file);
      const paraSubir = optimizado ?? file;
      const extension = getFileExtension(paraSubir) || getFileExtension(file);
      const storagePath = `principal/${idPublicacion}/${tipo}_${index + 1}_${Date.now()}.${extension}`;
      const storageRef = ref(FIREBASE_STORAGE, storagePath);

      try {
        await uploadBytes(storageRef, paraSubir, {
          contentType: paraSubir?.type || file?.type || 'image/webp',
          customMetadata: {
            idPublicacion,
            tipo,
            orden: String(index),
            nombreArchivo: file?.name || '',
            calidadOriginal: String(paraSubir === file),
            tamanoOriginalBytes: String(file?.size || 0),
            uploaderUid: String(usuario?.uid || ''),
            uploaderIdMiembros: String(getPrincipalMemberId(usuario) || ''),
          },
        });

        return {
          downloadUrl: await getDownloadURL(storageRef),
          storagePath,
          storageRef,
        };
      } catch (error) {
        await deleteObject(storageRef).catch(() => null);
        throw error;
      }
    })
  );
  const failedUpload = uploadResults.find((result) => result.status === 'rejected');

  if (failedUpload) {
    await Promise.all(
      uploadResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => deleteObject(result.value.storageRef).catch(() => null))
    );
    throw failedUpload.reason;
  }

  const uploads = uploadResults.map((result) => result.value);

  return uploads.map((item, index) => ({
    url: item.downloadUrl,
    rutaArchivo: item.storagePath,
    tipoArchivo: 'imagen',
    tipoMime: files[index]?.type || '',
    nombreArchivo: files[index]?.name || `imagen-${index + 1}`,
    tamanoBytes: files[index]?.size || 0,
    orden: index,
    calidadOriginal: true,
  }));
};

const deleteUploadedPrincipalImages = async (files = []) => {
  if (!FIREBASE_STORAGE) return;

  await Promise.all(
    files
      .map((file) => file?.rutaArchivo)
      .filter(Boolean)
      .map((storagePath) => deleteObject(ref(FIREBASE_STORAGE, storagePath)).catch(() => null))
  );
};

const reactionToLike = (reaction = {}) => ({
  id: reaction.idReaccion || reaction.id,
  idMiembros: reaction.usuarioIdMiembros,
  codigoMiembro: reaction.codigoMiembroUsuario,
  name: reaction.nombreUsuario,
  avatarUrl: reaction.fotoUsuarioURL,
});

const commentToUi = (comment = {}) => ({
  id: comment.idComentario || comment.id,
  idComentarioPadre: comment.idComentarioPadre || '',
  replyToName: comment.respuestaANombreAutor || '',
  uidAutor: comment.uidAutor || '',
  autorIdMiembros: comment.autorIdMiembros || null,
  codigoMiembroAutor: comment.codigoMiembroAutor || '',
  correoAutor: comment.correoAutor || '',
  nombreAutor: comment.nombreAutor || 'Usuario',
  fotoAutorURL: comment.fotoAutorURL || '',
  author: {
    id: comment.autorIdMiembros || comment.codigoMiembroAutor,
    uid: comment.uidAutor || '',
    idMiembros: comment.autorIdMiembros,
    codigoMiembro: comment.codigoMiembroAutor,
    correo: comment.correoAutor || '',
    name: comment.nombreAutor || 'Usuario',
    avatarUrl: comment.fotoAutorURL || '',
  },
  createdAt: toIso(comment.fechaCreacion),
  message: comment.mensaje || '',
  imageUrl: comment.imagenURL || '',
  replies: Array.isArray(comment.replies) ? comment.replies : [],
});

const publicationToUi = ({
  publication = {},
  comments = [],
  reactions = [],
  usuarioIdMiembros,
}) => {
  const archivosMultimedia = Array.isArray(publication.archivosMultimedia)
    ? publication.archivosMultimedia
    : [];
  const mediaItems = archivosMultimedia.map((item) => item.url).filter(Boolean);
  const commentItems = comments.map(commentToUi);
  const repliesByParent = commentItems.reduce((acc, comment) => {
    if (!comment.idComentarioPadre) return acc;

    return {
      ...acc,
      [comment.idComentarioPadre]: [...(acc[comment.idComentarioPadre] || []), comment],
    };
  }, {});
  const rootComments = commentItems
    .filter((comment) => !comment.idComentarioPadre)
    .map((comment) => ({ ...comment, replies: repliesByParent[comment.id] || [] }));

  return {
    id: publication.idPublicacion || publication.id,
    createdAt: toIso(publication.fechaCreacion),
    media: mediaItems[0] || '',
    mediaItems,
    message: publication.mensaje || '',
    personLikes: reactions.map(reactionToLike),
    comments: rootComments,
    isLikedByMe: reactions.some(
      (reaction) => Number(reaction.usuarioIdMiembros) === Number(usuarioIdMiembros)
    ),
    author: {
      id: publication.autorIdMiembros || publication.codigoMiembroAutor,
      uid: publication.uidAutor,
      idMiembros: publication.autorIdMiembros,
      codigoMiembro: publication.codigoMiembroAutor,
      correo: publication.correoAutor,
      displayName: publication.nombreAutor || 'Usuario',
      photoURL: publication.fotoAutorURL || '',
    },
    cantidadLikes: publication.cantidadLikes ?? reactions.length,
    cantidadComentarios: publication.cantidadComentarios ?? comments.length,
    cantidadCompartidos: publication.cantidadCompartidos ?? 0,
    cantidadReportes: publication.cantidadReportes ?? 0,
  };
};

const getCollectionDataByPublications = async ({ collectionName, ids }) => {
  if (!ids.length) return {};

  const chunks = Array.from({ length: Math.ceil(ids.length / 30) }, (_, index) =>
    ids.slice(index * 30, index * 30 + 30)
  );
  const snapshots = await Promise.all(
    chunks.map(async (chunk) => {
      const snapshot = await getDocs(
        query(collection(FIRESTORE, collectionName), where('idPublicacion', 'in', chunk))
      );

      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    })
  );

  return snapshots.flat().reduce((itemsByPublication, item) => {
    if (!item.idPublicacion || (item.estado || ESTADO_ACTIVO) !== ESTADO_ACTIVO) {
      return itemsByPublication;
    }

    return {
      ...itemsByPublication,
      [item.idPublicacion]: [...(itemsByPublication[item.idPublicacion] || []), item],
    };
  }, {});
};

const obtenerPerfilNotificacionAutor = async ({
  uidAutor = '',
  autorIdMiembros = null,
  codigoMiembroAutor = '',
  correoAutor = '',
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  if (uidAutor) {
    return {
      uid: String(uidAutor),
      rolDestinatario: '',
    };
  }

  const memberId = toNumberOrNull(autorIdMiembros);
  const codigo = String(codigoMiembroAutor || '').trim();
  const correo = String(correoAutor || '')
    .trim()
    .toLowerCase();

  if (!memberId && !codigo && !correo) return null;

  const filters = [
    ...(memberId
      ? [
          { field: 'idMiembros', value: memberId },
          { field: 'memberId', value: memberId },
        ]
      : []),
    ...(codigo
      ? [
          { field: 'codigoMiembro', value: codigo },
          { field: 'codigoUsuario', value: codigo },
          { field: 'memberId', value: codigo },
        ]
      : []),
    ...(correo
      ? [
          { field: 'correo', value: correo },
          { field: 'email', value: correo },
        ]
      : []),
  ];
  const lookups = COLECCIONES_USUARIOS_NOTIFICACIONES.flatMap((collectionName) =>
    filters.map((filter) => ({ collectionName, ...filter }))
  );
  const snapshots = await Promise.all(
    lookups.map((lookup) =>
      getDocs(
        query(
          collection(FIRESTORE, lookup.collectionName),
          where(lookup.field, '==', lookup.value),
          limit(1)
        )
      ).catch(() => ({ docs: [] }))
    )
  );
  const matchingIndex = snapshots.findIndex((snapshot) => snapshot.docs.length > 0);
  const matchingDocument = matchingIndex >= 0 ? snapshots[matchingIndex].docs[0] : null;
  const profile = matchingDocument
    ? {
        id: matchingDocument.id,
        coleccion: lookups[matchingIndex].collectionName,
        ...(matchingDocument.data() || {}),
      }
    : null;

  if (!profile) return null;

  return {
    uid: String(profile.uid || profile.id),
    rolDestinatario:
      profile.coleccion === 'admins' || profile.rol === 'admin' || profile.rol === 'administrador'
        ? 'admin'
        : 'usuario',
  };
};

const crearNotificacionComentarioPublicacion = async ({ publicacion, comentario, usuario }) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const autorIdMiembros = Number(publicacion?.autorIdMiembros || 0);
  const comentaristaIdMiembros = Number(
    comentario?.autorIdMiembros || getPrincipalMemberId(usuario) || 0
  );
  const autorUid = String(publicacion?.uidAutor || '').trim();
  const comentaristaUid = String(usuario?.uid || '').trim();
  const autorCodigo = String(publicacion?.codigoMiembroAutor || '').trim();
  const comentaristaCodigo = String(
    comentario?.codigoMiembroAutor || getCodigoMiembro(usuario) || ''
  ).trim();

  if (
    (autorUid && comentaristaUid && autorUid === comentaristaUid) ||
    (autorIdMiembros && comentaristaIdMiembros && autorIdMiembros === comentaristaIdMiembros) ||
    (autorCodigo && comentaristaCodigo && autorCodigo === comentaristaCodigo)
  ) {
    return null;
  }

  const destinatario = await obtenerPerfilNotificacionAutor(publicacion);

  if (!destinatario?.uid) return null;

  const fechaActual = new Date().toISOString();
  const idPublicacion = publicacion.idPublicacion || publicacion.id;
  const idComentario = comentario.idComentario || comentario.id;
  const actorNombre = comentario.nombreAutor || getUserName(usuario);
  const notificationId = `comentario_publicacion_${idPublicacion}_${idComentario}_${destinatario.uid}`;
  const esRespuesta = Boolean(comentario.idComentarioPadre);
  const mensaje = esRespuesta
    ? 'respondio un comentario en tu publicacion.'
    : 'comentó tu publicacion.';

  const notificacion = {
    id: notificationId,
    tipoNotificacion: 'publicacion_comentada',
    modulo: 'publicaciones',
    titulo: esRespuesta ? 'Respuesta en publicacion' : 'Comentario en publicacion',
    tituloHtml: `<p><strong>${escapeHtml(actorNombre)}</strong> ${escapeHtml(mensaje)}</p>`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: destinatario.rolDestinatario,
    idsDestinatarios: [destinatario.uid],
    prioridad: 'informativa',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(comentaristaIdMiembros || usuario?.uid || 'usuario'),
    actorTipo: 'usuario',
    actorNombre,
    actorFotoURL: comentario.fotoAutorURL || getUserPhoto(usuario),
    entidadTipo: 'publicacion',
    entidadId: String(idPublicacion),
    ruta: `/dashboard/principal/#comment-${idComentario}`,
    imagenTipo: 'persona',
    imagenURL: comentario.fotoAutorURL || getUserPhoto(usuario) || null,
    miniaturaURL: comentario.fotoAutorURL || getUserPhoto(usuario) || null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver publicacion',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      idPublicacion,
      idComentario,
      idComentarioPadre: comentario.idComentarioPadre || '',
      mensajeComentario: comentario.mensaje || '',
    },
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  return guardarNotificacionConfigurada(notificacion);
};

const getCommentAuthorFields = (comentario = {}) => ({
  uidAutor: comentario.uidAutor || comentario.author?.uid || '',
  autorIdMiembros: comentario.autorIdMiembros || comentario.author?.idMiembros || null,
  codigoMiembroAutor: comentario.codigoMiembroAutor || comentario.author?.codigoMiembro || '',
  correoAutor: comentario.correoAutor || comentario.author?.correo || '',
  nombreAutor: comentario.nombreAutor || comentario.author?.name || 'Usuario',
});

const crearNotificacionRespuestaComentarioPublicacion = async ({
  publicacion,
  comentario,
  comentarioPadre,
  usuario,
}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !comentarioPadre) return null;

  const autorComentario = getCommentAuthorFields(comentarioPadre);
  const autorIdMiembros = Number(autorComentario.autorIdMiembros || 0);
  const responderIdMiembros = Number(
    comentario?.autorIdMiembros || getPrincipalMemberId(usuario) || 0
  );
  const autorUid = String(autorComentario.uidAutor || '').trim();
  const responderUid = String(usuario?.uid || '').trim();
  const autorCodigo = String(autorComentario.codigoMiembroAutor || '').trim();
  const responderCodigo = String(
    comentario?.codigoMiembroAutor || getCodigoMiembro(usuario) || ''
  ).trim();
  const publicacionUid = String(publicacion?.uidAutor || '').trim();
  const publicacionIdMiembros = Number(publicacion?.autorIdMiembros || 0);
  const publicacionCodigo = String(publicacion?.codigoMiembroAutor || '').trim();

  if (
    (autorUid && responderUid && autorUid === responderUid) ||
    (autorIdMiembros && responderIdMiembros && autorIdMiembros === responderIdMiembros) ||
    (autorCodigo && responderCodigo && autorCodigo === responderCodigo)
  ) {
    return null;
  }

  if (
    (publicacionUid && autorUid && publicacionUid === autorUid) ||
    (publicacionIdMiembros && autorIdMiembros && publicacionIdMiembros === autorIdMiembros) ||
    (publicacionCodigo && autorCodigo && publicacionCodigo === autorCodigo)
  ) {
    return null;
  }

  const destinatario = await obtenerPerfilNotificacionAutor(autorComentario);

  if (!destinatario?.uid) return null;

  const fechaActual = new Date().toISOString();
  const idPublicacion = publicacion?.idPublicacion || publicacion?.id || comentario.idPublicacion;
  const idComentario = comentario.idComentario || comentario.id;
  const idComentarioPadre =
    comentario.idComentarioPadre || comentarioPadre.idComentario || comentarioPadre.id;
  const actorNombre = comentario.nombreAutor || getUserName(usuario);
  const mensaje = 'respondio a tu comentario.';
  const notificationId = `respuesta_comentario_${idPublicacion}_${idComentario}_${destinatario.uid}`;

  const notificacion = {
    id: notificationId,
    tipoNotificacion: 'publicacion_comentada',
    modulo: 'publicaciones',
    titulo: 'Respuesta a comentario',
    tituloHtml: `<p><strong>${escapeHtml(actorNombre)}</strong> ${escapeHtml(mensaje)}</p>`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: destinatario.rolDestinatario,
    idsDestinatarios: [destinatario.uid],
    prioridad: 'informativa',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(responderIdMiembros || usuario?.uid || 'usuario'),
    actorTipo: 'usuario',
    actorNombre,
    actorFotoURL: comentario.fotoAutorURL || getUserPhoto(usuario),
    entidadTipo: 'publicacion',
    entidadId: String(idPublicacion),
    ruta: `/dashboard/principal/#comment-${idComentario}`,
    imagenTipo: 'persona',
    imagenURL: comentario.fotoAutorURL || getUserPhoto(usuario) || null,
    miniaturaURL: comentario.fotoAutorURL || getUserPhoto(usuario) || null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver comentario',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      idPublicacion,
      idComentario,
      idComentarioPadre,
      mensajeComentario: comentario.mensaje || '',
      destinatarioComentarioNombre: autorComentario.nombreAutor,
    },
    creadoEnServidor: serverTimestamp(),
    actualizadoEnServidor: serverTimestamp(),
  };

  return guardarNotificacionConfigurada(notificacion);
};

const filtrarMocksPorAutor = (mocks = [], autorIdMiembros = null) => {
  const autorId = toNumberOrNull(autorIdMiembros);

  if (!autorId) return mocks;

  return mocks.filter((post) => {
    const postAutorId = toNumberOrNull(
      post?.author?.idMiembros ||
        post?.author?.autorIdMiembros ||
        post?.author?.id ||
        post?.autorIdMiembros
    );

    return postAutorId === autorId;
  });
};

export async function obtenerPublicacionesPrincipal({
  usuarioIdMiembros,
  autorIdMiembros = null,
  mocks = [],
  cursorFecha = '',
  paginaTamano = PRINCIPAL_PAGE_SIZE,
} = {}) {
  const autorId = toNumberOrNull(autorIdMiembros);
  const pageSize = Math.min(Math.max(Number(paginaTamano) || PRINCIPAL_PAGE_SIZE, 1), 20);

  if (!isFirebaseConfigured || !FIRESTORE) {
    return {
      items: filtrarMocksPorAutor(mocks, autorId),
      nextCursor: null,
      hasMore: false,
    };
  }

  const constraints = [];

  if (autorId) constraints.push(where('autorIdMiembros', '==', autorId));
  constraints.push(orderBy('fechaCreacion', 'desc'));
  if (cursorFecha) constraints.push(startAfter(cursorFecha));
  constraints.push(limit(pageSize + 1));

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones), ...constraints)
  );
  const hasMore = snapshot.docs.length > pageSize;

  const publicaciones = snapshot.docs
    .slice(0, pageSize)
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => (item.estado || ESTADO_ACTIVO) === ESTADO_ACTIVO)
    .sort((a, b) => String(toIso(b.fechaCreacion)).localeCompare(String(toIso(a.fechaCreacion))));

  if (!publicaciones.length) {
    return {
      items: cursorFecha || autorId ? [] : mocks,
      nextCursor: hasMore
        ? snapshot.docs[Math.min(pageSize - 1, snapshot.docs.length - 1)]?.data()?.fechaCreacion ||
          null
        : null,
      hasMore,
    };
  }

  const hiddenSnapshot = usuarioIdMiembros
    ? await getDocs(
        query(
          collection(FIRESTORE, COLECCIONES_PRINCIPAL.ocultas),
          where('usuarioIdMiembros', '==', usuarioIdMiembros)
        )
      )
    : { docs: [] };
  const publicacionesOcultas = new Set(
    hiddenSnapshot.docs.map((item) => item.data()?.idPublicacion).filter(Boolean)
  );
  const visibles = publicaciones.filter((item) => !publicacionesOcultas.has(item.idPublicacion));
  const ids = visibles.map((item) => item.idPublicacion).filter(Boolean);
  const [comentariosPorPublicacion, reaccionesPorPublicacion] = await Promise.all([
    getCollectionDataByPublications({ collectionName: COLECCIONES_PRINCIPAL.comentarios, ids }),
    getCollectionDataByPublications({ collectionName: COLECCIONES_PRINCIPAL.reacciones, ids }),
  ]);

  return {
    items: visibles.map((publication) =>
      publicationToUi({
        publication,
        comments: (comentariosPorPublicacion[publication.idPublicacion] || []).sort((a, b) =>
          String(toIso(a.fechaCreacion)).localeCompare(String(toIso(b.fechaCreacion)))
        ),
        reactions: reaccionesPorPublicacion[publication.idPublicacion] || [],
        usuarioIdMiembros,
      })
    ),
    nextCursor: hasMore ? publicaciones[publicaciones.length - 1]?.fechaCreacion || null : null,
    hasMore,
  };
}

export async function crearPublicacionPrincipal({
  mensaje = '',
  imagenes = [],
  usuario = {},
} = {}) {
  assertPrincipalIdentity(usuario);
  validatePrincipalImages(imagenes);
  const mensajeLimpio = validatePrincipalMessage(mensaje, {
    type: 'post',
    allowEmpty: imagenes.length > 0,
  });
  const idPublicacion = createId('publicacion');
  const archivosMultimedia = await uploadPrincipalImages({ idPublicacion, imagenes, usuario });
  const fechaCreacion = new Date().toISOString();
  const publicacion = {
    idPublicacion,
    ...buildAuthorFields(usuario),
    mensaje: mensajeLimpio,
    etiquetas: Array.from(new Set(mensajeLimpio.match(/#[A-Za-zÀ-ÿ0-9_]+/g) || [])),
    archivosMultimedia,
    visibilidad: VISIBILIDAD_PUBLICA,
    estado: ESTADO_ACTIVO,
    cantidadLikes: 0,
    cantidadComentarios: 0,
    cantidadCompartidos: 0,
    cantidadReportes: 0,
    fechaCreacion,
    fechaActualizacion: fechaCreacion,
    creadoEnServidor: isFirebaseConfigured ? serverTimestamp() : null,
    actualizadoEnServidor: isFirebaseConfigured ? serverTimestamp() : null,
  };

  if (isFirebaseConfigured && FIRESTORE) {
    const batch = writeBatch(FIRESTORE);
    batch.set(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion),
      cleanFirestoreData(publicacion)
    );

    archivosMultimedia.forEach((archivo) => {
      const idImagen = createId('imagen');

      batch.set(
        doc(FIRESTORE, COLECCIONES_PRINCIPAL.galeria, idImagen),
        cleanFirestoreData({
          idImagen,
          usuarioIdMiembros: getPrincipalMemberId(usuario),
          codigoMiembroUsuario: getCodigoMiembro(usuario),
          imagenURL: archivo.url,
          miniaturaURL: archivo.url,
          descripcion: mensajeLimpio,
          origen: 'publicacion',
          idPublicacion,
          visibilidad: VISIBILIDAD_PUBLICA,
          estado: ESTADO_ACTIVO,
          fechaCreacion,
        })
      );
    });

    try {
      await batch.commit();
    } catch (error) {
      await deleteUploadedPrincipalImages(archivosMultimedia);
      throw error;
    }
  }

  registrarAuditoriaSilenciosa({
    modulo: 'publicaciones',
    accion: 'publicacion_creada',
    descripcion: `Se creó una publicación de ${getUserName(usuario)}.`,
    entidad: {
      tipo: 'publicacion',
      id: idPublicacion,
      nombre: mensajeLimpio.slice(0, 80) || idPublicacion,
      ruta: `/dashboard/principal/#post-${idPublicacion}`,
    },
    despues: {
      idPublicacion,
      mensaje: mensajeLimpio,
      totalArchivos: archivosMultimedia.length,
      visibilidad: VISIBILIDAD_PUBLICA,
    },
    realizadoPor: usuario,
    origen: 'publicaciones',
  });

  return publicationToUi({
    publication: publicacion,
    usuarioIdMiembros: getPrincipalMemberId(usuario),
  });
}

export async function crearComentarioPublicacion({
  idPublicacion,
  mensaje = '',
  imagen = null,
  usuario = {},
  idComentarioPadre = '',
  comentarioPadre = null,
} = {}) {
  assertPrincipalIdentity(usuario);
  const mensajeLimpio = validatePrincipalMessage(mensaje, {
    type: 'comment',
    allowEmpty: Boolean(imagen),
  });
  if (imagen) validatePrincipalImages([imagen]);

  const idComentario = createId('comentario');
  const archivos = imagen
    ? await uploadPrincipalImages({
        idPublicacion,
        imagenes: [imagen],
        tipo: 'comentario',
        usuario,
      })
    : [];
  const fechaCreacion = new Date().toISOString();
  const comentario = {
    idComentario,
    idPublicacion,
    idComentarioPadre: idComentarioPadre || '',
    respuestaAIdComentario: idComentarioPadre || '',
    respuestaANombreAutor: comentarioPadre?.author?.name || comentarioPadre?.nombreAutor || '',
    ...buildAuthorFields(usuario),
    mensaje: mensajeLimpio,
    imagenURL: archivos[0]?.url || '',
    estado: ESTADO_ACTIVO,
    fechaCreacion,
    fechaActualizacion: fechaCreacion,
    creadoEnServidor: isFirebaseConfigured ? serverTimestamp() : null,
    actualizadoEnServidor: isFirebaseConfigured ? serverTimestamp() : null,
  };

  if (isFirebaseConfigured && FIRESTORE) {
    const publicacionSnapshot = await getDoc(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion)
    ).catch(() => null);
    const publicacion = publicacionSnapshot?.exists()
      ? { id: publicacionSnapshot.id, ...publicacionSnapshot.data() }
      : null;

    const batch = writeBatch(FIRESTORE);
    batch.set(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.comentarios, idComentario),
      cleanFirestoreData(comentario)
    );
    batch.update(doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion), {
      cantidadComentarios: increment(1),
      fechaActualizacion: comentario.fechaActualizacion,
      actualizadoEnServidor: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      await deleteUploadedPrincipalImages(archivos);
      throw error;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('principal:comentario-sincronizado', {
          detail: { idPublicacion, idComentario, idComentarioPadre: comentario.idComentarioPadre },
        })
      );
    }

    if (publicacion) {
      await crearNotificacionComentarioPublicacion({
        publicacion,
        comentario,
        usuario,
      }).catch((error) => console.error('[principal] no se pudo notificar comentario', error));

      if (comentario.idComentarioPadre) {
        await crearNotificacionRespuestaComentarioPublicacion({
          publicacion,
          comentario,
          comentarioPadre,
          usuario,
        }).catch((error) =>
          console.error('[principal] no se pudo notificar respuesta de comentario', error)
        );
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('notificaciones:actualizar'));
      }
    }
  }

  return commentToUi(comentario);
}

export async function eliminarPublicacionPrincipal({ idPublicacion, usuario = {} } = {}) {
  assertPrincipalIdentity(usuario);
  if (!isFirebaseConfigured || !FIRESTORE || !idPublicacion) {
    return null;
  }

  const publicacionRef = doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion);
  const publicacionSnapshot = await getDoc(publicacionRef);

  if (!publicacionSnapshot.exists()) {
    throw new Error('La publicacion no existe.');
  }

  const publicacion = publicacionSnapshot.data() || {};
  const autorIdMiembros = Number(publicacion.autorIdMiembros || 0);
  const usuarioIdMiembros = Number(getPrincipalMemberId(usuario) || 0);
  const esAutor =
    Boolean(autorIdMiembros && usuarioIdMiembros && autorIdMiembros === usuarioIdMiembros) ||
    Boolean(
      publicacion.codigoMiembroAutor &&
      getCodigoMiembro(usuario) &&
      publicacion.codigoMiembroAutor === getCodigoMiembro(usuario)
    );

  if (!esAutor) {
    throw new Error('Solo el autor puede borrar esta publicacion.');
  }

  const fechaEliminacion = new Date().toISOString();

  await updateDoc(publicacionRef, {
    estado: 'eliminado',
    eliminadoPorIdMiembros: usuarioIdMiembros || null,
    codigoMiembroEliminadoPor: getCodigoMiembro(usuario),
    fechaEliminacion,
    fechaActualizacion: fechaEliminacion,
    actualizadoEnServidor: serverTimestamp(),
  });

  registrarAuditoriaSilenciosa({
    modulo: 'publicaciones',
    accion: 'publicacion_eliminada',
    descripcion: `Se eliminó una publicación de ${publicacion.nombreAutor || 'usuario'}.`,
    severidad: 'importante',
    entidad: {
      tipo: 'publicacion',
      id: idPublicacion,
      nombre: String(publicacion.mensaje || idPublicacion).slice(0, 80),
      ruta: '/dashboard/principal',
    },
    antes: publicacion,
    realizadoPor: usuario,
    origen: 'publicaciones',
  });

  return { idPublicacion, estado: 'eliminado' };
}

export async function crearRecordatorioPublicacion({
  publicacion = {},
  usuario = {},
  fechaProgramada,
  canales = {},
} = {}) {
  if (!fechaProgramada) {
    throw new Error('Selecciona una fecha para el recordatorio.');
  }

  const fechaRecordatorio =
    fechaProgramada?.toDate?.()?.toISOString?.() ||
    (fechaProgramada instanceof Date
      ? fechaProgramada.toISOString()
      : new Date(fechaProgramada).toISOString());

  if (Number.isNaN(new Date(fechaRecordatorio).getTime())) {
    throw new Error('La fecha del recordatorio no es valida.');
  }

  const idTarea = createId('recordatorio_publicacion');
  const idPublicacion = publicacion.id || publicacion.idPublicacion;
  const uidDestinatario = String(usuario?.uid || usuario?.id || '');
  const fechaCreacion = new Date().toISOString();
  const tarea = {
    idTarea,
    tipoTarea: 'recordatorio_publicacion',
    tipoNotificacion: 'recordatorio_publicacion',
    modulo: 'publicaciones',
    estado: 'pendiente',
    idsDestinatarios: uidDestinatario ? [uidDestinatario] : [],
    rolDestinatario: 'usuario',
    usuarioIdMiembros: getPrincipalMemberId(usuario),
    codigoMiembroUsuario: getCodigoMiembro(usuario),
    nombreUsuario: getUserName(usuario),
    fotoUsuarioURL: getUserPhoto(usuario),
    correoUsuario: usuario?.correo || usuario?.email || '',
    idPublicacion,
    mensajePublicacion: publicacion.message || publicacion.mensaje || '',
    autorIdMiembros: publicacion.author?.idMiembros || publicacion.autorIdMiembros || null,
    nombreAutor: publicacion.author?.displayName || publicacion.author?.name || '',
    fechaProgramada: fechaRecordatorio,
    fechaCreacion,
    fechaEnvio: null,
    canales: {
      campanita: true,
      chat: Boolean(canales.chat),
      correo: Boolean(canales.correo),
    },
    ruta: `/dashboard/principal/#post-${idPublicacion}`,
    metadatos: {
      idPublicacion,
      mensajePublicacion: publicacion.message || publicacion.mensaje || '',
      canalesSolicitados: {
        chat: Boolean(canales.chat),
        correo: Boolean(canales.correo),
      },
    },
    creadoEnServidor: isFirebaseConfigured ? serverTimestamp() : null,
    actualizadoEnServidor: isFirebaseConfigured ? serverTimestamp() : null,
  };

  if (isFirebaseConfigured && FIRESTORE) {
    await setDoc(
      doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.tareas, idTarea),
      cleanFirestoreData(tarea)
    );
  }

  if (typeof window !== 'undefined') {
    const delayMs = new Date(fechaRecordatorio).getTime() - Date.now();
    const maxTimeoutMs = 2147483647;

    if (delayMs <= 0) {
      window.dispatchEvent(new Event('notificaciones:actualizar'));
    } else if (delayMs <= maxTimeoutMs) {
      window.setTimeout(() => {
        window.dispatchEvent(new Event('notificaciones:actualizar'));
      }, delayMs + 1000);
    }
  }

  return tarea;
}

export async function alternarReaccionPublicacion({
  idPublicacion,
  usuario = {},
  activo = true,
} = {}) {
  assertPrincipalIdentity(usuario);
  const idReaccion = getUserReactionDocId({ idPublicacion, user: usuario });
  const usuarioIdMiembros = getPrincipalMemberId(usuario);

  if (isFirebaseConfigured && FIRESTORE) {
    const reactionRef = doc(FIRESTORE, COLECCIONES_PRINCIPAL.reacciones, idReaccion);
    const publicationRef = doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion);

    await runTransaction(FIRESTORE, async (transaction) => {
      const [reactionSnapshot, publicationSnapshot] = await Promise.all([
        transaction.get(reactionRef),
        transaction.get(publicationRef),
      ]);

      if (!publicationSnapshot.exists()) throw new Error('La publicación no existe.');
      if (activo && reactionSnapshot.exists()) return;
      if (!activo && !reactionSnapshot.exists()) return;

      if (activo) {
        transaction.set(
          reactionRef,
          cleanFirestoreData({
            idReaccion,
            idPublicacion,
            ...buildUserFields(usuario),
            tipoReaccion: 'like',
            estado: ESTADO_ACTIVO,
            fechaCreacion: new Date().toISOString(),
            creadoEnServidor: serverTimestamp(),
          })
        );
      } else {
        transaction.delete(reactionRef);
      }

      const currentLikes = Math.max(Number(publicationSnapshot.data()?.cantidadLikes || 0), 0);
      transaction.update(publicationRef, {
        cantidadLikes: activo ? currentLikes + 1 : Math.max(currentLikes - 1, 0),
        fechaActualizacion: new Date().toISOString(),
        actualizadoEnServidor: serverTimestamp(),
      });
    });
  }

  return reactionToLike({
    idReaccion,
    usuarioIdMiembros,
    codigoMiembroUsuario: getCodigoMiembro(usuario),
    nombreUsuario: getUserName(usuario),
    fotoUsuarioURL: getUserPhoto(usuario),
  });
}

export async function ocultarPublicacionPrincipal({ idPublicacion, usuario = {} } = {}) {
  assertPrincipalIdentity(usuario);
  const usuarioIdMiembros = getPrincipalMemberId(usuario);
  const idPublicacionOculta = `${idPublicacion}_${usuarioIdMiembros || usuario?.uid || 'usuario'}`;

  if (isFirebaseConfigured && FIRESTORE) {
    await setDoc(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.ocultas, idPublicacionOculta),
      cleanFirestoreData({
        idPublicacionOculta,
        idPublicacion,
        ...buildUserFields(usuario),
        fechaCreacion: new Date().toISOString(),
        creadoEnServidor: serverTimestamp(),
      }),
      { merge: true }
    );
  }

  return { idPublicacionOculta, idPublicacion };
}

export async function deshacerOcultarPublicacionPrincipal({ idPublicacion, usuario = {} } = {}) {
  assertPrincipalIdentity(usuario);
  const usuarioIdMiembros = getPrincipalMemberId(usuario);
  const idPublicacionOculta = `${idPublicacion}_${usuarioIdMiembros || usuario?.uid || 'usuario'}`;

  if (isFirebaseConfigured && FIRESTORE) {
    await deleteDoc(doc(FIRESTORE, COLECCIONES_PRINCIPAL.ocultas, idPublicacionOculta)).catch(
      () => null
    );
  }

  return { idPublicacionOculta, idPublicacion };
}

export async function registrarCompartidoPublicacion({
  idPublicacion,
  usuario = {},
  tipoDestino = 'enlace',
  idDestino = '',
  urlCompartida = '',
} = {}) {
  assertPrincipalIdentity(usuario);
  const idCompartido = createId('compartido');

  if (isFirebaseConfigured && FIRESTORE) {
    const batch = writeBatch(FIRESTORE);
    batch.set(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.compartidos, idCompartido),
      cleanFirestoreData({
        idCompartido,
        idPublicacion,
        compartidoPorIdMiembros: getPrincipalMemberId(usuario),
        codigoMiembroCompartidoPor: getCodigoMiembro(usuario),
        tipoDestino,
        idDestino,
        urlCompartida,
        fechaCreacion: new Date().toISOString(),
        creadoEnServidor: serverTimestamp(),
      })
    );
    batch.update(doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion), {
      cantidadCompartidos: increment(1),
      fechaActualizacion: new Date().toISOString(),
      actualizadoEnServidor: serverTimestamp(),
    });
    await batch.commit();
  }

  return { idCompartido, idPublicacion };
}

export async function registrarReportePublicacion({
  idPublicacion,
  usuario = {},
  razon = '',
} = {}) {
  assertPrincipalIdentity(usuario);
  const razonLimpia = String(razon || '').trim();
  const reportadoPor = getPrincipalMemberId(usuario);

  if (!razonLimpia) throw new Error('Selecciona o escribe un motivo para el reporte.');
  if (razonLimpia.length > 500) throw new Error('El motivo no puede superar 500 caracteres.');

  const idReporte = `reporte_${idPublicacion}_${reportadoPor || usuario?.uid || 'usuario'}`;

  if (isFirebaseConfigured && FIRESTORE) {
    const reportRef = doc(FIRESTORE, COLECCIONES_PRINCIPAL.reportes, idReporte);
    const publicationRef = doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion);
    const batch = writeBatch(FIRESTORE);

    batch.set(
      reportRef,
      cleanFirestoreData({
        idReporte,
        idPublicacion,
        reportadoPorIdMiembros: reportadoPor,
        codigoMiembroReportadoPor: getCodigoMiembro(usuario),
        nombreReportadoPor: getUserName(usuario),
        fotoReportadoPorURL: getUserPhoto(usuario),
        razon: razonLimpia,
        estado: 'pendiente_revision',
        administradorIdMiembros: null,
        notaAdministrador: '',
        fechaCreacion: new Date().toISOString(),
        fechaResolucion: null,
        creadoEnServidor: serverTimestamp(),
      })
    );
    batch.update(publicationRef, {
      cantidadReportes: increment(1),
      fechaActualizacion: new Date().toISOString(),
      actualizadoEnServidor: serverTimestamp(),
    });
    await batch.commit();
  }

  registrarAuditoriaSilenciosa({
    modulo: 'publicaciones',
    accion: 'publicacion_reportada',
    descripcion: `Se reportó una publicación. Motivo: ${razon || 'No especificado'}.`,
    severidad: 'importante',
    entidad: {
      tipo: 'publicacion',
      id: idPublicacion,
      nombre: idPublicacion,
      ruta: `/dashboard/principal/#post-${idPublicacion}`,
    },
    despues: { idReporte, idPublicacion, razon: razonLimpia },
    realizadoPor: usuario,
    origen: 'publicaciones',
  });

  return { idReporte, idPublicacion };
}
