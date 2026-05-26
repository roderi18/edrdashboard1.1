import {
  query,
  where,
  limit,
  getDocs,
  collection,
  getCountFromServer,
} from 'firebase/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { listarAuditoriaSistema } from 'src/services/audit-log-service';
import { ADMIN_BACKUP_COLLECTIONS, obtenerUltimoRespaldoAdmin } from 'src/services/admin-maintenance-service';
import {
  FIREBASE_STORAGE_LIMIT_BYTES,
  getCachedFirebaseStorageUsageSummary,
} from 'src/services/firebase-storage-usage-service';

// ----------------------------------------------------------------------

const STORAGE_WARNING_PERCENT = 75;
const STORAGE_CRITICAL_PERCENT = 90;
const BACKUP_WARNING_DAYS = 7;
const BACKUP_CRITICAL_DAYS = 30;
const UNREAD_NOTIFICATIONS_WARNING = 50;
const UNREAD_NOTIFICATIONS_CRITICAL = 150;

const now = () => Date.now();

const daysSince = (dateValue) => {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  return Math.floor((now() - date.getTime()) / (24 * 60 * 60 * 1000));
};

const countQuery = async (queryRef) => {
  try {
    const snapshot = await getCountFromServer(queryRef);
    return snapshot.data().count || 0;
  } catch {
    return 0;
  }
};

const sampleCollection = async (collectionName) => {
  try {
    const snapshot = await getDocs(query(collection(FIRESTORE, collectionName), limit(1)));
    return snapshot.docs[0]?.id || '';
  } catch {
    return '';
  }
};

const getStatusSummary = (checks) => {
  const critical = checks.filter((item) => item.status === 'critico').length;
  const warning = checks.filter((item) => item.status === 'advertencia').length;

  if (critical) return { status: 'critico', label: 'Crítico', detail: `${critical} chequeos críticos` };
  if (warning) return { status: 'advertencia', label: 'Advertencia', detail: `${warning} chequeos con alerta` };

  return { status: 'correcto', label: 'Correcto', detail: 'Sin alertas críticas' };
};

const buildCollectionChecks = async () => {
  const rows = await Promise.all(
    ADMIN_BACKUP_COLLECTIONS.map(async (item) => {
      const collectionRef = collection(FIRESTORE, item.key);
      const [count, sampleId] = await Promise.all([
        countQuery(collectionRef),
        sampleCollection(item.key),
      ]);
      const isEmpty = count === 0;
      const status = isEmpty && item.required ? 'critico' : isEmpty ? 'advertencia' : 'correcto';

      return {
        id: `coleccion_${item.key}`,
        area: 'Base de datos',
        name: item.label,
        status,
        value: count,
        detail:
          status === 'critico'
            ? 'Colección requerida sin registros.'
            : status === 'advertencia'
              ? 'Colección opcional vacía.'
              : `Disponible. Muestra: ${sampleId || 'sin muestra'}.`,
      };
    })
  );

  return rows;
};

const buildNotificationChecks = async () => {
  const notificationsRef = collection(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones);
  const unreadCount = await countQuery(query(notificationsRef, where('estado', '==', 'no_leida')));
  const uploadErrorsCount = await countQuery(
    query(
      notificationsRef,
      where('tipoNotificacion', '==', 'error_subida_archivo_imagen'),
      where('estado', '==', 'no_leida')
    )
  );
  const unreadStatus =
    unreadCount >= UNREAD_NOTIFICATIONS_CRITICAL
      ? 'critico'
      : unreadCount >= UNREAD_NOTIFICATIONS_WARNING
        ? 'advertencia'
        : 'correcto';

  return [
    {
      id: 'notificaciones_no_leidas',
      area: 'Notificaciones',
      name: 'Notificaciones pendientes',
      status: unreadStatus,
      value: unreadCount,
      detail:
        unreadStatus === 'correcto'
          ? 'Volumen normal de notificaciones pendientes.'
          : 'Hay muchas notificaciones sin atender.',
    },
    {
      id: 'errores_subida_pendientes',
      area: 'Archivos',
      name: 'Errores de subida pendientes',
      status: uploadErrorsCount ? 'advertencia' : 'correcto',
      value: uploadErrorsCount,
      detail: uploadErrorsCount
        ? 'Hay errores de archivo o imagen esperando revisión.'
        : 'Sin errores de subida pendientes.',
    },
  ];
};

const buildAuditChecks = async () => {
  const logs = await listarAuditoriaSistema({ maxRegistros: 50 });
  const failedLogs = logs.filter((item) => item.resultado && item.resultado !== 'exitoso');
  const importantLogs = logs.filter((item) =>
    ['critica', 'crítica', 'importante', 'error'].includes(String(item.severidad || '').toLowerCase())
  );
  const latestLog = logs[0] || null;

  return {
    checks: [
      {
        id: 'auditoria_reciente',
        area: 'Auditoría',
        name: 'Auditoría reciente',
        status: logs.length ? 'correcto' : 'advertencia',
        value: logs.length,
        detail: logs.length
          ? `Último registro: ${latestLog?.accion || latestLog?.descripcion || latestLog?.id}.`
          : 'No hay registros recientes de auditoría.',
      },
      {
        id: 'auditoria_fallos',
        area: 'Auditoría',
        name: 'Fallos recientes',
        status: failedLogs.length ? 'advertencia' : 'correcto',
        value: failedLogs.length,
        detail: failedLogs.length
          ? 'Hay acciones recientes con resultado no exitoso.'
          : 'Sin fallos recientes registrados.',
      },
      {
        id: 'eventos_importantes',
        area: 'Auditoría',
        name: 'Eventos importantes',
        status: importantLogs.length > 10 ? 'advertencia' : 'correcto',
        value: importantLogs.length,
        detail: 'Eventos importantes o críticos en los últimos 50 registros.',
      },
    ],
    latestLog,
  };
};

const buildBackupCheck = async () => {
  const backup = await obtenerUltimoRespaldoAdmin();
  const ageDays = daysSince(backup?.fecha);
  const status =
    ageDays === null
      ? 'advertencia'
      : ageDays >= BACKUP_CRITICAL_DAYS
        ? 'critico'
        : ageDays >= BACKUP_WARNING_DAYS
          ? 'advertencia'
          : 'correcto';

  return {
    check: {
      id: 'respaldo_reciente',
      area: 'Respaldo',
      name: 'Último respaldo',
      status,
      value: ageDays === null ? 'Sin respaldo' : `${ageDays} días`,
      detail:
        ageDays === null
          ? 'No hay respaldo administrativo registrado.'
          : `Último archivo: ${backup?.archivo || 'sin nombre'}.`,
    },
    backup,
  };
};

const buildStorageCheck = () => {
  const storage = getCachedFirebaseStorageUsageSummary({ allowStale: true });
  const percentUsed = Number(storage?.percentUsed || 0);
  const status = !storage?.generatedAt
    ? 'advertencia'
    : percentUsed >= STORAGE_CRITICAL_PERCENT
      ? 'critico'
      : percentUsed >= STORAGE_WARNING_PERCENT
        ? 'advertencia'
        : 'correcto';

  return {
    check: {
      id: 'storage_cache',
      area: 'Storage',
      name: 'Uso de Firebase Storage',
      status,
      value: storage?.generatedAt ? `${percentUsed}%` : 'Sin cache',
      detail: storage?.generatedAt
        ? `${storage.totalFiles || 0} archivos. Este panel usa el resumen cacheado.`
        : 'Abre Archivos para generar el resumen sin hacer una lectura pesada desde salud.',
    },
    storage: storage || {
      limitBytes: FIREBASE_STORAGE_LIMIT_BYTES,
      usedBytes: 0,
      percentUsed: 0,
      totalFiles: 0,
      generatedAt: null,
    },
  };
};

export async function obtenerSaludSistemaAdmin() {
  if (!isFirebaseConfigured || !FIRESTORE) {
    const checks = [
      {
        id: 'firebase_configuracion',
        area: 'Firebase',
        name: 'Configuración',
        status: 'critico',
        value: 'No disponible',
        detail: 'Firebase no está configurado en este entorno.',
      },
    ];

    return {
      generatedAt: new Date().toISOString(),
      summary: getStatusSummary(checks),
      checks,
      metrics: {
        totalCollections: 0,
        totalRecords: 0,
        unreadNotifications: 0,
        storagePercent: 0,
      },
    };
  }

  const [collectionChecks, notificationChecks, auditResult, backupResult] = await Promise.all([
    buildCollectionChecks(),
    buildNotificationChecks(),
    buildAuditChecks(),
    buildBackupCheck(),
  ]);
  const storageResult = buildStorageCheck();
  const firebaseCheck = {
    id: 'firebase_configuracion',
    area: 'Firebase',
    name: 'Configuración',
    status: 'correcto',
    value: 'Activo',
    detail: 'Firestore está disponible para el panel administrativo.',
  };
  const checks = [
    firebaseCheck,
    storageResult.check,
    backupResult.check,
    ...notificationChecks,
    ...auditResult.checks,
    ...collectionChecks,
  ];
  const unreadNotifications =
    notificationChecks.find((item) => item.id === 'notificaciones_no_leidas')?.value || 0;

  return {
    generatedAt: new Date().toISOString(),
    summary: getStatusSummary(checks),
    checks,
    latestLog: auditResult.latestLog,
    backup: backupResult.backup,
    storage: storageResult.storage,
    metrics: {
      totalCollections: collectionChecks.length,
      totalRecords: collectionChecks.reduce((total, item) => total + Number(item.value || 0), 0),
      unreadNotifications,
      storagePercent: Number(storageResult.storage?.percentUsed || 0),
    },
  };
}
