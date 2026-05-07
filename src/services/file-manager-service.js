import { ref, deleteObject } from 'firebase/storage';
import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
} from 'firebase/firestore';

import { uploadFilesToStorage } from 'src/utils/firebase-file-storage';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

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

export const subirArchivosGestorFirestore = async ({ files = [], parentId = null } = {}) => {
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

export const eliminarArchivoGestorFirestore = async (file) => {
  const fileId = typeof file === 'string' ? file : file?.id;
  const storagePath = typeof file === 'string' ? '' : file?.storagePath;

  if (!isFirebaseConfigured || !FIRESTORE || !fileId) return;

  if (storagePath && FIREBASE_STORAGE) {
    await deleteObject(ref(FIREBASE_STORAGE, storagePath)).catch(() => null);
  }

  await deleteDoc(doc(FIRESTORE, COLECCION_GESTOR_ARCHIVOS, String(fileId)));
};
