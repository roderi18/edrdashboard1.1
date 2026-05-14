import {
  doc,
  query,
  limit,
  where,
  setDoc,
  getDocs,
  deleteDoc,
  increment,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { uploadOptimizedImages } from 'src/utils/firebase-image-storage';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

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

export const getPrincipalMemberId = (user = {}) =>
  toNumberOrNull(user?.idMiembros) ||
  toNumberOrNull(user?.miembroId) ||
  toNumberOrNull(user?.idMiembro);

const getCodigoMiembro = (user = {}) =>
  user?.codigoMiembro || user?.codigoUsuario || user?.codigo || user?.memberId || '';

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

const buildAuthorFields = (user = {}) => ({
  autorIdMiembros: getPrincipalMemberId(user),
  codigoMiembroAutor: getCodigoMiembro(user),
  nombreAutor: getUserName(user),
  fotoAutorURL: getUserPhoto(user),
  idDestacamentoAutor: getUserDestacamentoId(user),
  nombreDestacamentoAutor: getUserDestacamentoName(user),
});

const buildUserFields = (user = {}, prefix = 'usuario') => ({
  [`${prefix}IdMiembros`]: getPrincipalMemberId(user),
  [`codigoMiembro${prefix[0].toUpperCase()}${prefix.slice(1)}`]: getCodigoMiembro(user),
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
  const uploadResult = await uploadOptimizedImages({
    files,
    preset: 'post',
    storagePathBuilder: (file, index) =>
      `principal/${idPublicacion}/${tipo}_${index + 1}_${Date.now()}.webp`,
    metadataBuilder: (file, index) => ({
      idPublicacion,
      tipo,
      orden: String(index),
      nombreArchivo: file?.name || '',
    }),
  });

  return uploadResult.uploads.map((item, index) => ({
    url: item.downloadUrl,
    rutaArchivo: item.storagePath,
    tipoArchivo: 'imagen',
    nombreArchivo: files[index]?.name || `imagen-${index + 1}`,
    tamanoBytes: item.optimizedSizeBytes || files[index]?.size || 0,
    orden: index,
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
  author: {
    id: comment.autorIdMiembros || comment.codigoMiembroAutor,
    idMiembros: comment.autorIdMiembros,
    codigoMiembro: comment.codigoMiembroAutor,
    name: comment.nombreAutor || 'Usuario',
    avatarUrl: comment.fotoAutorURL || '',
  },
  createdAt: toIso(comment.fechaCreacion),
  message: comment.mensaje || '',
  imageUrl: comment.imagenURL || '',
});

const publicationToUi = ({ publication = {}, comments = [], reactions = [], usuarioIdMiembros }) => {
  const archivosMultimedia = Array.isArray(publication.archivosMultimedia)
    ? publication.archivosMultimedia
    : [];
  const mediaItems = archivosMultimedia.map((item) => item.url).filter(Boolean);

  return {
    id: publication.idPublicacion || publication.id,
    createdAt: toIso(publication.fechaCreacion),
    media: mediaItems[0] || '',
    mediaItems,
    message: publication.mensaje || '',
    personLikes: reactions.map(reactionToLike),
    comments: comments.map(commentToUi),
    isLikedByMe: reactions.some(
      (reaction) => Number(reaction.usuarioIdMiembros) === Number(usuarioIdMiembros)
    ),
    author: {
      id: publication.autorIdMiembros || publication.codigoMiembroAutor,
      idMiembros: publication.autorIdMiembros,
      codigoMiembro: publication.codigoMiembroAutor,
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

export async function obtenerPublicacionesPrincipal({ usuarioIdMiembros, mocks = [] } = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return mocks;
  }

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones), limit(30))
  );

  const publicaciones = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => (item.estado || ESTADO_ACTIVO) === ESTADO_ACTIVO)
    .sort((a, b) => String(toIso(b.fechaCreacion)).localeCompare(String(toIso(a.fechaCreacion))));

  if (!publicaciones.length) {
    return mocks;
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

  return publicationToUi({ publication: publicacion, usuarioIdMiembros: getPrincipalMemberId(usuario) });
}

export async function crearComentarioPublicacion({
  idPublicacion,
  mensaje = '',
  imagen = null,
  usuario = {},
} = {}) {
  const idComentario = createId('comentario');
  const archivos = imagen
    ? await uploadPrincipalImages({ idPublicacion, imagenes: [imagen], tipo: 'comentario' })
    : [];
  const fechaCreacion = new Date().toISOString();
  const comentario = {
    idComentario,
    idPublicacion,
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
    await setDoc(
      doc(FIRESTORE, COLECCIONES_PRINCIPAL.comentarios, idComentario),
      cleanFirestoreData(comentario)
    );
    await updateDoc(doc(FIRESTORE, COLECCIONES_PRINCIPAL.publicaciones, idPublicacion), {
      cantidadComentarios: increment(1),
      fechaActualizacion: comentario.fechaActualizacion,
      actualizadoEnServidor: serverTimestamp(),
    }).catch(() => null);
  }

  return commentToUi(comentario);
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

  return { idReporte, idPublicacion };
}
