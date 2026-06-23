import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
} from 'firebase/firestore';

import { uploadFilesToStorage } from 'src/utils/firebase-file-storage';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

import { ROLES } from 'src/auth/permissions/roles';

export const COLECCION_GESTOR_ARCHIVOS = 'gestorArchivos';

const getFileExtension = (fileName = '') =>
  String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase() || '';

const buildFileId = (file, index = 0) =>
  `${Date.now()}-${index}-${String(file?.name || 'archivo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

const getUserRoleId = (user = {}) =>
  String(user?.rolId || user?.roleId || user?.rolCodigo || user?.roleCodigo || user?.rol || user?.role || '').trim();

const assertCanManageFileManager = (user = {}) => {
  if (getUserRoleId(user) !== ROLES.ADMINISTRADOR_GLOBAL) {
    throw new Error('Solo el Administrador Global puede gestionar archivos.');
  }
};

const buildRenamedStoragePath = (storagePath = '', nextName = '') => {
  const lastSlashIndex = String(storagePath).lastIndexOf('/');

  return lastSlashIndex >= 0
    ? `${String(storagePath).slice(0, lastSlashIndex + 1)}${nextName}`
    : nextName;
};

const isStorageSourceFile = (file = {}) => file?.source === 'storage' && Boolean(file?.storagePath);

export const isAllowedFileManagerFile = (file) => {
  const type = String(file?.type || '').toLowerCase();

  return type.startsWith('image/') || type === 'application/pdf';
};

export const mapearArchivoGestorFirestoreAUi = (data = {}) => ({
  id: data.id,
  name: data.nombre || data.name || '',
  type: data.extension || getFileExtension(data.nombre || data.name),
  url: data.url || '',
  parentId: data.parentId ?? null,
  shared: Array.isArray(data.compartidoCon) ? data.compartidoCon : [],
  tags: Array.isArray(data.etiquetas) ? data.etiquetas : [],
  size: Number(data.tamano || 0),
  totalFiles: 0,
  createdAt: data.fechaCreacion || data.createdAt || new Date().toISOString(),
  modifiedAt: data.fechaModificacion || data.modifiedAt || data.fechaCreacion || new Date().toISOString(),
  isFavorited: Boolean(data.favorito),
  storagePath: data.storagePath || '',
  contentType: data.tipoMime || '',
});

export const listarArchivosGestorFirestore = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_GESTOR_ARCHIVOS));

  return snapshot.docs.map((item) =>
    mapearArchivoGestorFirestoreAUi({ id: item.id, ...item.data() })
  );
};

export const subirArchivosGestorFirestore = async ({ files = [], parentId = null, user = {} } = {}) => {
  assertCanManageFileManager(user);

  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para subir archivos.');
  }

  const validFiles = files.filter(isAllowedFileManagerFile);

  if (!validFiles.length) {
    throw new Error('Solo se permiten imagenes y archivos PDF.');
  }

  const uploads = await uploadFilesToStorage({
    files: validFiles,
    storagePathBuilder: (file, index) =>
      `gestor-archivos/${parentId || 'raiz'}/${buildFileId(file, index)}`,
    metadataBuilder: (file, index) => ({
      modulo: 'gestor_archivos',
      parentId: parentId || 'raiz',
      indice: String(index),
    }),
  });

  const createdAt = new Date().toISOString();
  const documents = uploads.map((upload, index) => {
    const id = buildFileId(validFiles[index], index);
    const fileName = upload.nombre || validFiles[index]?.name || 'archivo';
    const document = {
      id,
      nombre: fileName,
      tipo: upload.tipo?.startsWith('image/') ? 'imagen' : 'pdf',
      extension: getFileExtension(fileName),
      tipoMime: upload.tipo,
      url: upload.downloadURL || upload.url,
      storagePath: upload.storagePath,
      parentId,
      tamano: Number(upload.tamano || 0),
      tamanoOriginal: Number(upload.tamanoOriginal || validFiles[index]?.size || 0),
      optimizado: Boolean(upload.optimizado),
      favorito: false,
      etiquetas: [],
      compartidoCon: [],
      fechaCreacion: createdAt,
      fechaModificacion: createdAt,
      origen: 'gestor_archivos',
      almacenamiento: 'firebase',
    };

    return document;
  });

  await Promise.all(
    documents.map((document) =>
      setDoc(doc(FIRESTORE, COLECCION_GESTOR_ARCHIVOS, document.id), document)
    )
  );

  return documents.map(mapearArchivoGestorFirestoreAUi);
};

export const eliminarArchivoGestorFirestore = async (file, user = {}) => {
  assertCanManageFileManager(user);

  const fileId = typeof file === 'string' ? file : file?.id;
  const storagePath = typeof file === 'string' ? '' : file?.storagePath;

  if (!isFirebaseConfigured || !fileId) return;

  if (isStorageSourceFile(file)) {
    if (FIREBASE_STORAGE && storagePath) {
      await deleteObject(ref(FIREBASE_STORAGE, storagePath));
    }

    return;
  }

  if (!FIRESTORE) return;

  if (storagePath && FIREBASE_STORAGE) {
    await deleteObject(ref(FIREBASE_STORAGE, storagePath)).catch(() => null);
  }

  await deleteDoc(doc(FIRESTORE, COLECCION_GESTOR_ARCHIVOS, String(fileId)));
};

export const renombrarArchivoGestorFirestore = async (file, newBaseName, user = {}) => {
  assertCanManageFileManager(user);

  const fileId = typeof file === 'string' ? file : file?.id;
  const currentName = typeof file === 'string' ? '' : file?.name || '';
  const extension = getFileExtension(currentName);
  const cleanBaseName = String(newBaseName || '')
    .trim()
    .replace(new RegExp(`\\.${extension}$`, 'i'), '');

  if (!isFirebaseConfigured || !fileId || !cleanBaseName) return null;

  const nextName = extension ? `${cleanBaseName}.${extension}` : cleanBaseName;
  const modifiedAt = new Date().toISOString();

  if (isStorageSourceFile(file)) {
    if (!FIREBASE_STORAGE) {
      throw new Error('Firebase Storage no esta configurado para renombrar archivos.');
    }

    const currentStoragePath = file.storagePath;
    const nextStoragePath = buildRenamedStoragePath(currentStoragePath, nextName);

    if (nextStoragePath === currentStoragePath) {
      return {
        ...file,
        name: nextName,
        modifiedAt,
      };
    }

    const currentStorageRef = ref(FIREBASE_STORAGE, currentStoragePath);
    const nextStorageRef = ref(FIREBASE_STORAGE, nextStoragePath);
    const downloadUrl = await getDownloadURL(currentStorageRef);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error('No se pudo leer el archivo original para renombrarlo.');
    }

    const blob = await response.blob();

    await uploadBytes(nextStorageRef, blob, {
      contentType: file.contentType || blob.type || undefined,
      customMetadata: {
        renamedFrom: currentStoragePath,
      },
    });
    await deleteObject(currentStorageRef);

    return {
      ...file,
      id: nextStoragePath,
      name: nextName,
      type: getFileExtension(nextName),
      storagePath: nextStoragePath,
      modifiedAt,
    };
  }

  if (!FIRESTORE) {
    throw new Error('Firestore no esta configurado para renombrar este archivo.');
  }

  const payload = {
    id: fileId,
    nombre: nextName,
    extension: getFileExtension(nextName),
    fechaModificacion: modifiedAt,
  };

  await setDoc(doc(FIRESTORE, COLECCION_GESTOR_ARCHIVOS, String(fileId)), payload, {
    merge: true,
  });

  return {
    ...(typeof file === 'string' ? {} : file),
    id: fileId,
    name: nextName,
    type: payload.extension,
    modifiedAt,
  };
};
