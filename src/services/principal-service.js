import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  doc,
  query,
  limit,
  where,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  increment,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

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

const uploadPrincipalImages = async ({ idPublicacion, imagenes = [], tipo = 'publicacion' }) => {
  if (!imagenes.length) return [];

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
  const uploads = await Promise.all(
    files.map(async (file, index) => {
      const extension = getFileExtension(file);
      const storagePath = `principal/${idPublicacion}/${tipo}_${index + 1}_${Date.now()}.${extension}`;
      const storageRef = ref(FIREBASE_STORAGE, storagePath);

      await uploadBytes(storageRef, file, {
        contentType: file?.type || 'image/jpeg',
        customMetadata: {
          idPublicacion,
          tipo,
          orden: String(index),
          nombreArchivo: file?.name || '',
          calidadOriginal: 'true',
        },
      });

      return {
        downloadUrl: await getDownloadURL(storageRef),
        storagePath,
      };
    })
  );

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

const publicationToUi = ({ publication = {}, comments = [], reactions = [], usuarioIdMiembros }) => {
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
    cantidadLikes: publication.cantidadLikes || reactions.length,
    cantidadComentarios: publication.cantidadComentarios || comments.length,
    cantidadCompartidos: publication.cantidadCompartidos || 0,
    cantidadReportes: publication.cantidadReportes || 0,
  };
};

const getCollectionDataByPublications = async ({ collectionName, ids }) => {
  if (!ids.length) return {};

  const entries = await Promise.all(
    ids.map(async (idPublicacion) => {
      const snapshot = await getDocs(
        query(collection(FIRESTORE, collectionName), where('idPublicacion', '==', idPublicacion))
      );

      return [idPublicacion, snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))];
    })
  );

  return Object.fromEntries(entries);
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
  const correo = String(correoAutor || '').trim().toLowerCase();

  if (!memberId && !codigo && !correo) return null;

  const snapshots = await Promise.all(
    COLECCIONES_USUARIOS_NOTIFICACIONES.map((collectionName) =>
      getDocs(collection(FIRESTORE, collectionName)).catch(() => ({ docs: [] }))
    )
  );

  const profile =
    snapshots
      .flatMap((snapshot, index) =>
        snapshot.docs.map((item) => ({
          id: item.id,
          coleccion: COLECCIONES_USUARIOS_NOTIFICACIONES[index],
          ...(item.data() || {}),
        }))
      )
      .find((item) => {
        const perfilIdMiembros = toNumberOrNull(item.idMiembros || item.memberId);
        const perfilCodigo = String(item.codigoMiembro || item.codigoUsuario || item.memberId || '')
          .trim()
          .toLowerCase();
        const perfilCorreo = String(item.correo || item.email || '').trim().toLowerCase();

        return (
          (memberId && perfilIdMiembros === memberId) ||
          (codigo && perfilCodigo === codigo.toLowerCase()) ||
          (correo && perfilCorreo === correo)
        );
      }) || null;

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
  const comentaristaIdMiembros = Number(comentario?.autorIdMiembros || getPrincipalMemberId(usuario) || 0);
  const autorUid = String(publicacion?.uidAutor || '').trim();
  const comentaristaUid = String(usuario?.uid || '').trim();
  const autorCodigo = String(publicacion?.codigoMiembroAutor || '').trim();
  const comentaristaCodigo = String(comentario?.codigoMiembroAutor || getCodigoMiembro(usuario) || '').trim();

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
  const responderIdMiembros = Number(comentario?.autorIdMiembros || getPrincipalMemberId(usuario) || 0);
  const autorUid = String(autorComentario.uidAutor || '').trim();
  const responderUid = String(usuario?.uid || '').trim();
  const autorCodigo = String(autorComentario.codigoMiembroAutor || '').trim();
  const responderCodigo = String(comentario?.codigoMiembroAutor || getCodigoMiembro(usuario) || '').trim();
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
  const idComentarioPadre = comentario.idComentarioPadre || comentarioPadre.idComentario || comentarioPadre.id;
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
      post?.author?.idMiembros || post?.author?.autorIdMiembros || post?.author?.id || post?.autorIdMiembros
    );

    return postAutorId === autorId;
  });
};

export async function obtenerPublicacionesPrincipal({
  usuarioIdMiembros,
  autorIdMiembros = null,
  mocks = [],
} = {}) {
  const autorId = toNumberOrNull(autorIdMiembros);

  if (!isFirebaseConfigured || !FIRESTORE) {
    return filtrarMocksPorAutor(mocks, autorId);
  }

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones), limit(30))
  );

  const publicaciones = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => (item.estado || ESTADO_ACTIVO) === ESTADO_ACTIVO)
    .filter((item) => !autorId || Number(item.autorIdMiembros) === autorId)
    .sort((a, b) => String(toIso(b.fechaCreacion)).localeCompare(String(toIso(a.fechaCreacion))));

  if (!publicaciones.length) {
    return autorId ? [] : mocks;
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

  return visibles.map((publication) =>
    publicationToUi({
      publication,
      comments: (comentariosPorPublicacion[publication.idPublicacion] || []).sort((a, b) =>
        String(toIso(a.fechaCreacion)).localeCompare(String(toIso(b.fechaCreacion)))
      ),
      reactions: reaccionesPorPublicacion[publication.idPublicacion] || [],
      usuarioIdMiembros,
    })
  );
}

export async function crearPublicacionPrincipal({ mensaje = '', imagenes = [], usuario = {} } = {}) {
  const idPublicacion = createId('publicacion');
  const archivosMultimedia = await uploadPrincipalImages({ idPublicacion, imagenes });
  const fechaCreacion = new Date().toISOString();
  const publicacion = {
    idPublicacion,
    ...buildAuthorFields(usuario),
    mensaje,
    etiquetas: Array.from(new Set(String(mensaje).match(/#[A-Za-zÀ-ÿ0-9_]+/g) || [])),
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
    await setDoc(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion),
      cleanFirestoreData(publicacion)
    );

    await Promise.all(
      archivosMultimedia.map((archivo) => {
        const idImagen = createId('imagen');

        return setDoc(
          doc(FIRESTORE, COLECCIONES_PRINCIPAL.galeria, idImagen),
          cleanFirestoreData({
            idImagen,
            usuarioIdMiembros: getPrincipalMemberId(usuario),
            codigoMiembroUsuario: getCodigoMiembro(usuario),
            imagenURL: archivo.url,
            miniaturaURL: archivo.url,
            descripcion: mensaje,
            origen: 'publicacion',
            idPublicacion,
            visibilidad: VISIBILIDAD_PUBLICA,
            estado: ESTADO_ACTIVO,
            fechaCreacion,
          })
        );
      })
    );
  }

  registrarAuditoriaSilenciosa({
    modulo: 'publicaciones',
    accion: 'publicacion_creada',
    descripcion: `Se creó una publicación de ${getUserName(usuario)}.`,
    entidad: {
      tipo: 'publicacion',
      id: idPublicacion,
      nombre: String(mensaje || '').slice(0, 80) || idPublicacion,
      ruta: `/dashboard/principal/#post-${idPublicacion}`,
    },
    despues: {
      idPublicacion,
      mensaje,
      totalArchivos: archivosMultimedia.length,
      visibilidad: VISIBILIDAD_PUBLICA,
    },
    realizadoPor: usuario,
    origen: 'publicaciones',
  });

  return publicationToUi({ publication: publicacion, usuarioIdMiembros: getPrincipalMemberId(usuario) });
}

export async function crearComentarioPublicacion({
  idPublicacion,
  mensaje = '',
  imagen = null,
  usuario = {},
  idComentarioPadre = '',
  comentarioPadre = null,
} = {}) {
  const idComentario = createId('comentario');
  const archivos = imagen
    ? await uploadPrincipalImages({ idPublicacion, imagenes: [imagen], tipo: 'comentario' })
    : [];
  const fechaCreacion = new Date().toISOString();
  const comentario = {
    idComentario,
    idPublicacion,
    idComentarioPadre: idComentarioPadre || '',
    respuestaAIdComentario: idComentarioPadre || '',
    respuestaANombreAutor: comentarioPadre?.author?.name || comentarioPadre?.nombreAutor || '',
    ...buildAuthorFields(usuario),
    mensaje,
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

    await setDoc(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.comentarios, idComentario),
      cleanFirestoreData(comentario)
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('principal:comentario-sincronizado', {
          detail: { idPublicacion, idComentario, idComentarioPadre: comentario.idComentarioPadre },
        })
      );
    }

    await updateDoc(doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion), {
      cantidadComentarios: increment(1),
      fechaActualizacion: comentario.fechaActualizacion,
      actualizadoEnServidor: serverTimestamp(),
    }).catch(() => null);

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

export async function alternarReaccionPublicacion({ idPublicacion, usuario = {}, activo = true } = {}) {
  const idReaccion = getUserReactionDocId({ idPublicacion, user: usuario });
  const usuarioIdMiembros = getPrincipalMemberId(usuario);

  if (isFirebaseConfigured && FIRESTORE) {
    if (activo) {
      await setDoc(
        doc(FIRESTORE, COLECCIONES_PRINCIPAL.reacciones, idReaccion),
        cleanFirestoreData({
          idReaccion,
          idPublicacion,
          ...buildUserFields(usuario),
          tipoReaccion: 'like',
          fechaCreacion: new Date().toISOString(),
          creadoEnServidor: serverTimestamp(),
        }),
        { merge: true }
      );
    } else {
      await deleteDoc(doc(FIRESTORE, COLECCIONES_PRINCIPAL.reacciones, idReaccion)).catch(
        () => null
      );
    }

    await updateDoc(doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion), {
      cantidadLikes: increment(activo ? 1 : -1),
      fechaActualizacion: new Date().toISOString(),
      actualizadoEnServidor: serverTimestamp(),
    }).catch(() => null);
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
  const idCompartido = createId('compartido');

  if (isFirebaseConfigured && FIRESTORE) {
    await setDoc(
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
    await updateDoc(doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion), {
      cantidadCompartidos: increment(1),
      fechaActualizacion: new Date().toISOString(),
      actualizadoEnServidor: serverTimestamp(),
    }).catch(() => null);
  }

  return { idCompartido, idPublicacion };
}

export async function registrarReportePublicacion({
  idPublicacion,
  usuario = {},
  razon = '',
} = {}) {
  const idReporte = createId('reporte');

  if (isFirebaseConfigured && FIRESTORE) {
    await setDoc(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.reportes, idReporte),
      cleanFirestoreData({
        idReporte,
        idPublicacion,
        reportadoPorIdMiembros: getPrincipalMemberId(usuario),
        codigoMiembroReportadoPor: getCodigoMiembro(usuario),
        nombreReportadoPor: getUserName(usuario),
        fotoReportadoPorURL: getUserPhoto(usuario),
        razon,
        estado: 'pendiente_revision',
        administradorIdMiembros: null,
        notaAdministrador: '',
        fechaCreacion: new Date().toISOString(),
        fechaResolucion: null,
        creadoEnServidor: serverTimestamp(),
      })
    );
    await updateDoc(doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion), {
      cantidadReportes: increment(1),
      fechaActualizacion: new Date().toISOString(),
      actualizadoEnServidor: serverTimestamp(),
    }).catch(() => null);
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
    despues: { idReporte, idPublicacion, razon },
    realizadoPor: usuario,
    origen: 'publicaciones',
  });

  return { idReporte, idPublicacion };
}
