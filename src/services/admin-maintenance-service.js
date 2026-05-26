import {
  doc,
  query,
  limit,
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  getCountFromServer,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { listarAuditoriaSistema } from 'src/services/audit-log-service';

// ----------------------------------------------------------------------

export const ADMIN_BACKUP_COLLECTIONS = [
  { key: 'admins', label: 'Administradores', required: true },
  { key: 'usuarios_roles', label: 'Roles de usuarios', required: true },
  { key: 'notificaciones', label: 'Notificaciones', required: false },
  { key: 'tipos_notificaciones', label: 'Tipos de notificaciones', required: false },
  { key: 'plantillas_notificaciones', label: 'Plantillas de notificaciones', required: false },
  { key: 'preferencias_notificaciones', label: 'Preferencias de notificaciones', required: false },
  { key: 'auditoria_sistema', label: 'Auditoría del sistema', required: false },
  { key: 'gestorArchivos', label: 'Gestor de archivos', required: false },
  { key: 'asistencias', label: 'Asistencias', required: false },
  { key: 'publicaciones', label: 'Publicaciones', required: false },
  { key: 'pedidos', label: 'Pedidos', required: false },
  { key: 'facturas', label: 'Facturas', required: false },
  { key: 'productos', label: 'Productos', required: false },
];

const BACKUP_META_COLLECTION = 'respaldos_admin';
const BACKUP_META_DOC = 'ultimo';

const normalizeFirestoreValue = (value) => {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizeFirestoreValue(entryValue)])
    );
  }

  return value;
};

const downloadJson = ({ data, fileName }) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const getDateStamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export async function obtenerUltimoRespaldoAdmin() {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const snapshot = await getDoc(doc(FIRESTORE, BACKUP_META_COLLECTION, BACKUP_META_DOC)).catch(
    () => null
  );

  return snapshot?.exists() ? snapshot.data() : null;
}

export async function inspeccionarColeccionesAdmin() {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado para mantenimiento.');
  }

  const rows = await Promise.all(
    ADMIN_BACKUP_COLLECTIONS.map(async (item) => {
      const [countSnapshot, sampleSnapshot] = await Promise.all([
        getCountFromServer(collection(FIRESTORE, item.key)).catch(() => null),
        getDocs(query(collection(FIRESTORE, item.key), limit(1))).catch(() => ({ docs: [] })),
      ]);
      const count = countSnapshot?.data?.().count || 0;
      const empty = count === 0;

      return {
        ...item,
        count,
        status: empty && item.required ? 'inconsistente' : empty ? 'vacia' : 'correcta',
        detail:
          empty && item.required
            ? 'Colección requerida sin registros.'
            : empty
              ? 'Sin registros.'
              : `Muestra disponible: ${sampleSnapshot.docs[0]?.id || 'sin muestra'}.`,
      };
    })
  );

  return rows;
}

export async function exportarRespaldoAdmin({ usuario = {} } = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado para exportar respaldo.');
  }

  const generatedAt = new Date().toISOString();
  const collections = {};

  await Promise.all(
    ADMIN_BACKUP_COLLECTIONS.map(async (item) => {
      const snapshot = await getDocs(collection(FIRESTORE, item.key)).catch(() => ({ docs: [] }));

      collections[item.key] = snapshot.docs.map((entry) => ({
        id: entry.id,
        ...normalizeFirestoreValue(entry.data()),
      }));
    })
  );

  const backup = {
    generadoEn: generatedAt,
    generadoPor: {
      uid: usuario?.uid || usuario?.id || null,
      nombre: usuario?.displayName || usuario?.nombre || usuario?.email || usuario?.correo || null,
      correo: usuario?.email || usuario?.correo || null,
    },
    colecciones: collections,
  };
  const fileName = `respaldo-admin-${getDateStamp()}.json`;

  downloadJson({ data: backup, fileName });

  const resumen = {
    fecha: generatedAt,
    archivo: fileName,
    totalColecciones: ADMIN_BACKUP_COLLECTIONS.length,
    totalRegistros: Object.values(collections).reduce((total, rows) => total + rows.length, 0),
    generadoPor: backup.generadoPor,
    actualizadoEnServidor: serverTimestamp(),
  };

  await setDoc(doc(FIRESTORE, BACKUP_META_COLLECTION, BACKUP_META_DOC), resumen, { merge: true });

  return resumen;
}

export async function descargarLogsAdmin() {
  const logs = await listarAuditoriaSistema({ maxRegistros: 1000 });
  const fileName = `logs-auditoria-${getDateStamp()}.json`;

  downloadJson({ data: logs, fileName });

  return { fileName, total: logs.length };
}
