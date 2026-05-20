import { ref, deleteObject } from 'firebase/storage';
import { doc, query, where, setDoc, getDocs, deleteDoc, collection } from 'firebase/firestore';

import { uploadFilesToStorage } from 'src/utils/firebase-file-storage';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  crearRegistroHistorialMiembro,
  registrarCambiosHistorialMiembro,
} from 'src/services/member-history-service';

export const COLECCION_DOCUMENTOS_SALUD_MIEMBROS = 'documentos_salud_miembros';

const getFileExtension = (fileName = '') =>
  String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase() || '';

const sanitizeFileName = (fileName = 'archivo') =>
  String(fileName || 'archivo')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildDocumentId = (file, index = 0) => `${Date.now()}-${index}-${sanitizeFileName(file?.name)}`;

const getHealthFileType = (fileName = '') => {
  const extension = getFileExtension(fileName);

  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) return extension;
  if (['doc', 'docx'].includes(extension)) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'excel';

  return extension || 'file';
};

const resolveDocumentCategory = (data = {}) => {
  if (data.tipoDocumentoSalud) return data.tipoDocumentoSalud;
  if (data.categoriaDocumento) return data.categoriaDocumento;

  const fileName = String(data.nombreArchivo || data.nombre || '').toLowerCase();

  if (fileName.includes('acta') || fileName.includes('nacimiento')) return 'acta_nacimiento';
  if (fileName.includes('seguro')) return 'seguro_medico';
  if (fileName.includes('cedula') || fileName.includes('cédula')) return 'cedula_identidad';

  return 'otros_documentos';
};

const mapearDocumentoSaludFirestoreAUi = (data = {}) => ({
  id: data.idDocumento || data.id,
  idDocumento: data.idDocumento || data.id,
  idMiembros: data.idMiembros,
  codigoMiembro: data.codigoMiembro || '',
  name: data.nombreArchivo || data.nombre || '',
  title: data.nombreArchivo || data.nombre || '',
  type: getHealthFileType(data.nombreArchivo || data.nombre),
  url: data.urlArchivo || data.url || '',
  storagePath: data.rutaStorage || data.storagePath || '',
  size: Number(data.tamanoBytes ?? data.tamano ?? data.size ?? 0),
  contentType: data.tipoArchivo || data.tipoMime || '',
  documentCategory: resolveDocumentCategory(data),
  tipoDocumentoSalud: resolveDocumentCategory(data),
  shared: Array.isArray(data.compartidoCon) ? data.compartidoCon : [],
  tags: ['salud'],
  createdAt: data.creadoEn || data.fechaCreacion || new Date().toISOString(),
  modifiedAt: data.actualizadoEn || data.fechaModificacion || data.creadoEn || new Date().toISOString(),
  isFavorited: false,
});

export const listarDocumentosSaludMiembro = async (idMiembros) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return [];

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_DOCUMENTOS_SALUD_MIEMBROS),
      where('idMiembros', '==', Number(idMiembros))
    )
  );

  return snapshot.docs
    .map((item) => mapearDocumentoSaludFirestoreAUi({ id: item.id, ...item.data() }))
    .filter((item) => item.estado !== 'eliminado')
    .sort((a, b) => String(b.modifiedAt || '').localeCompare(String(a.modifiedAt || '')));
};

export const subirDocumentosSaludMiembro = async ({
  files = [],
  idMiembros,
  codigoMiembro = '',
  documentCategory = 'otros_documentos',
  creadoPor = {},
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para subir documentos de salud.');
  }

  if (!idMiembros) {
    throw new Error('El documento de salud necesita idMiembros.');
  }

  const uploads = await uploadFilesToStorage({
    files,
    storagePathBuilder: (file, index) =>
      `documentos-salud-miembros/${idMiembros}/${buildDocumentId(file, index)}`,
    metadataBuilder: (file, index) => ({
      modulo: 'documentos_salud_miembros',
      idMiembros: String(idMiembros),
      codigoMiembro: String(codigoMiembro || ''),
      tipoDocumentoSalud: String(documentCategory),
      indice: String(index),
    }),
  });
  const now = new Date().toISOString();
  const documents = uploads.map((upload, index) => {
    const idDocumento = buildDocumentId(files[index], index);
    const nombreArchivo = upload.nombre || files[index]?.name || 'archivo';

    return {
      idDocumento,
      idMiembros: Number(idMiembros),
      codigoMiembro,
      nombreArchivo,
      nombreOriginal: upload.nombreOriginal || files[index]?.name || nombreArchivo,
      tipoArchivo: upload.tipo || files[index]?.type || 'application/octet-stream',
      extension: getFileExtension(nombreArchivo),
      tamanoBytes: Number(upload.tamano || files[index]?.size || 0),
      tamanoOriginalBytes: Number(upload.tamanoOriginal || files[index]?.size || 0),
      urlArchivo: upload.downloadURL || upload.url,
      rutaStorage: upload.storagePath,
      categoria: 'salud',
      tipoDocumentoSalud: documentCategory,
      estado: 'activo',
      creadoEn: now,
      actualizadoEn: now,
      creadoPorUid: creadoPor.uid || '',
      creadoPorNombre: creadoPor.displayName || creadoPor.email || '',
      compartidoCon: [],
      optimizado: Boolean(upload.optimizado),
    };
  });

  await Promise.all(
    documents.map((documento) =>
      setDoc(
        doc(FIRESTORE, COLECCION_DOCUMENTOS_SALUD_MIEMBROS, documento.idDocumento),
        documento
      )
    )
  );

  await Promise.all(
    documents.map((documento) =>
      crearRegistroHistorialMiembro({
        idMiembro: idMiembros,
        codigoMiembro,
        modulo: 'Dispensa médica',
        campo: 'documentoSalud',
        campoAfectado: 'Documento de salud',
        antes: '',
        despues: documento.nombreArchivo,
        usuario: creadoPor,
        metadata: {
          origen: 'member-health-documents-service',
          accion: 'subir_documento',
          idDocumento: documento.idDocumento,
          tipoDocumentoSalud: documento.tipoDocumentoSalud,
        },
      })
    )
  ).catch((error) => {
    console.error('[member health documents] member history failed', error);
  });

  return documents.map(mapearDocumentoSaludFirestoreAUi);
};

export const renombrarDocumentoSaludMiembro = async (documento, nuevoNombre, usuario) => {
  if (!isFirebaseConfigured || !FIRESTORE || !documento?.id) return null;

  const now = new Date().toISOString();
  const payload = {
    nombreArchivo: nuevoNombre,
    extension: getFileExtension(nuevoNombre),
    actualizadoEn: now,
  };

  await setDoc(
    doc(FIRESTORE, COLECCION_DOCUMENTOS_SALUD_MIEMBROS, String(documento.id)),
    payload,
    { merge: true }
  );

  registrarCambiosHistorialMiembro({
    idMiembro: documento.idMiembros,
    codigoMiembro: documento.codigoMiembro,
    modulo: 'Dispensa médica',
    antes: { nombreArchivo: documento.name || documento.nombreArchivo || '' },
    despues: { nombreArchivo: nuevoNombre },
    campos: { nombreArchivo: 'Nombre del documento de salud' },
    usuario,
    metadata: {
      origen: 'member-health-documents-service',
      accion: 'renombrar_documento',
      idDocumento: documento.id,
    },
  }).catch((error) => {
    console.error('[member health documents] member history failed', error);
  });

  return mapearDocumentoSaludFirestoreAUi({
    ...documento,
    idDocumento: documento.id,
    nombreArchivo: nuevoNombre,
    tamanoBytes: documento.size,
    actualizadoEn: now,
  });
};

export const eliminarDocumentoSaludMiembro = async (documento, usuario) => {
  const fileId = typeof documento === 'string' ? documento : documento?.id;
  const storagePath = typeof documento === 'string' ? '' : documento?.storagePath;

  if (!isFirebaseConfigured || !FIRESTORE || !fileId) return;

  if (storagePath && FIREBASE_STORAGE) {
    await deleteObject(ref(FIREBASE_STORAGE, storagePath)).catch(() => null);
  }

  await deleteDoc(doc(FIRESTORE, COLECCION_DOCUMENTOS_SALUD_MIEMBROS, String(fileId)));

  if (typeof documento !== 'string') {
    crearRegistroHistorialMiembro({
      idMiembro: documento.idMiembros,
      codigoMiembro: documento.codigoMiembro,
      modulo: 'Dispensa médica',
      campo: 'documentoSalud',
      campoAfectado: 'Documento de salud',
      antes: documento.name || documento.nombreArchivo || fileId,
      despues: '',
      usuario,
      metadata: {
        origen: 'member-health-documents-service',
        accion: 'eliminar_documento',
        idDocumento: fileId,
      },
    }).catch((error) => {
      console.error('[member health documents] member history failed', error);
    });
  }
};
