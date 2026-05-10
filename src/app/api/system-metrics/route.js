import { getDocs, collection, collectionGroup } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const MEMBERS_API_URL = 'https://systexploradores.somee.com/api/Miembros/GetAllMiembros';
const GENERAL_STORAGE_BYTES = 5 * 1024 ** 3;

const textEncoder = new TextEncoder();

const nowIso = () => new Date().toISOString();

const getByteSize = (value) => textEncoder.encode(JSON.stringify(value ?? null)).length;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getCreatedAt = (data = {}) =>
  toDate(
    data.createdAt ||
      data.fechaCreacion ||
      data.fechaRegistro ||
      data.enviadoEn ||
      data.timestamp ||
      data.fecha ||
      data.updatedAt ||
      data.fechaModificacion
  );

const getDocumentStorageBytes = (data = {}) => {
  const explicitSize = Number(
    data.tamano || data.size || data.tamanoOriginal || data.bytes || data.storageBytes || 0
  );

  return Number.isFinite(explicitSize) && explicitSize > 0 ? explicitSize : getByteSize(data);
};

const emptyMetric = (name, icon) => ({
  name,
  icon,
  count: 0,
  bytes: 0,
  years: {},
  yearBytes: {},
  sources: [],
});

const mergeMetric = (target, source) => {
  target.count += source.count;
  target.bytes += source.bytes;
  target.sources.push(...source.sources);

  Object.entries(source.years).forEach(([year, count]) => {
    target.years[year] = (target.years[year] || 0) + count;
  });

  Object.entries(source.yearBytes || {}).forEach(([year, bytes]) => {
    target.yearBytes[year] = (target.yearBytes[year] || 0) + bytes;
  });

  return target;
};

const readCollectionMetric = async (collectionName) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return {
      count: 0,
      bytes: 0,
      years: {},
      yearBytes: {},
      sources: [{ name: collectionName, error: 'Firebase no configurado' }],
    };
  }

  try {
    const snapshot = await getDocs(collection(FIRESTORE, collectionName));
    const metric = {
      count: 0,
      bytes: 0,
      years: {},
      yearBytes: {},
      sources: [{ name: collectionName }],
    };

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const createdAt = getCreatedAt(data);
      const year = createdAt?.getFullYear?.();
      const documentBytes = getDocumentStorageBytes(data);

      metric.count += 1;
      metric.bytes += documentBytes;

      if (year) {
        metric.years[year] = (metric.years[year] || 0) + 1;
        metric.yearBytes[year] = (metric.yearBytes[year] || 0) + documentBytes;
      }
    });

    return metric;
  } catch (error) {
    return {
      count: 0,
      bytes: 0,
      years: {},
      yearBytes: {},
      sources: [{ name: collectionName, error: error.message }],
    };
  }
};

const readCollectionGroupMetric = async (groupName) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return {
      count: 0,
      bytes: 0,
      years: {},
      yearBytes: {},
      sources: [{ name: groupName, error: 'Firebase no configurado' }],
    };
  }

  try {
    const snapshot = await getDocs(collectionGroup(FIRESTORE, groupName));
    const metric = {
      count: 0,
      bytes: 0,
      years: {},
      yearBytes: {},
      sources: [{ name: `${groupName}/*` }],
    };

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const createdAt = getCreatedAt(data);
      const year = createdAt?.getFullYear?.();
      const documentBytes = getDocumentStorageBytes(data);

      metric.count += 1;
      metric.bytes += documentBytes;

      if (year) {
        metric.years[year] = (metric.years[year] || 0) + 1;
        metric.yearBytes[year] = (metric.yearBytes[year] || 0) + documentBytes;
      }
    });

    return metric;
  } catch (error) {
    return {
      count: 0,
      bytes: 0,
      years: {},
      yearBytes: {},
      sources: [{ name: `${groupName}/*`, error: error.message }],
    };
  }
};

const readMetricGroup = async ({ name, icon, collections = [], collectionGroups = [] }) => {
  const base = emptyMetric(name, icon);
  const metrics = await Promise.all([
    ...collections.map(readCollectionMetric),
    ...collectionGroups.map(readCollectionGroupMetric),
  ]);

  return metrics.reduce(mergeMetric, base);
};

const readApiResponseMetric = async ({ name, icon, url }) => {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const text = await response.text();
    const json = JSON.parse(text);
    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.Data)
          ? json.Data
          : Array.isArray(json?.items)
            ? json.items
            : [];
    const bytes = textEncoder.encode(text).length;
    const currentYear = new Date().getFullYear();
    const count = rows.length || (text ? 1 : 0);

    return {
      ...emptyMetric(name, icon),
      count,
      bytes,
      years: { [currentYear]: count },
      yearBytes: { [currentYear]: bytes },
      sources: [{ name: url, status: response.status }],
    };
  } catch (error) {
    return {
      ...emptyMetric(name, icon),
      sources: [{ name: url, error: error.message }],
    };
  }
};

const getYears = (metrics = []) => {
  const yearSet = new Set();

  metrics.forEach((metric) => {
    Object.keys(metric.years || {}).forEach((year) => yearSet.add(Number(year)));
  });

  if (!yearSet.size) {
    return [];
  }

  return Array.from(yearSet).sort((a, b) => a - b).slice(-6);
};

const buildYearlyChart = (metrics = []) => {
  const years = getYears(metrics);

  return {
    series: [
      {
        name: 'Registros',
        valueType: 'count',
        categories: years.map(String),
        data: metrics.map((metric) => ({
          name: metric.name,
          data: years.map((year) => metric.years?.[year] || 0),
        })),
      },
      {
        name: 'Espacio',
        valueType: 'bytes',
        categories: years.map(String),
        data: metrics.map((metric) => ({
          name: metric.name,
          data: years.map((year) => metric.yearBytes?.[year] || 0),
        })),
      },
    ],
  };
};

const buildView = ({ title, storageTitle, countLabel, total, metrics }) => {
  const used = metrics.reduce((sum, metric) => sum + metric.bytes, 0);
  const safeTotal = Math.max(total, used);

  return {
    title,
    storageTitle,
    countLabel,
    total: safeTotal,
    used,
    chartPercent: safeTotal ? Math.min(100, Number(((used / safeTotal) * 100).toFixed(3))) : 0,
    categories: metrics.map((metric) => ({
      name: metric.name,
      usedStorage: metric.bytes,
      filesCount: metric.count,
      icon: metric.icon,
      sources: metric.sources,
    })),
    widgets: metrics.slice(0, 3).map((metric) => ({
      title: metric.name,
      value: metric.bytes,
      count: metric.count,
      total: safeTotal,
      icon: metric.icon,
    })),
    chart: buildYearlyChart(metrics),
  };
};

export async function GET() {
  const [
    fileMetrics,
    databaseMetrics,
    apiMembersMetric,
    apiLogMetric,
  ] = await Promise.all([
    Promise.all([
      readMetricGroup({
        name: 'Gestor de archivos',
        icon: 'solar:folder-bold',
        collections: ['gestorArchivos'],
      }),
      readMetricGroup({
        name: 'Fotos',
        icon: 'solar:gallery-bold',
        collections: ['fotos'],
      }),
      readMetricGroup({
        name: 'Salud',
        icon: 'solar:document-medicine-bold',
        collections: ['documentos_salud_miembros'],
      }),
      readMetricGroup({
        name: 'Adjuntos de chat',
        icon: 'solar:paperclip-rounded-bold',
        collectionGroups: ['mensajes'],
      }),
    ]),
    Promise.all([
      readMetricGroup({
        name: 'Usuarios',
        icon: 'solar:users-group-rounded-bold',
        collections: ['users', 'usuarios_roles', 'admins'],
      }),
      readMetricGroup({
        name: 'Comercio',
        icon: 'solar:cart-large-bold',
        collections: [
          'productos',
          'ordenes',
          'recibos',
          'direcciones',
          'carritos',
          'movimientos_inventario',
        ],
      }),
      readMetricGroup({
        name: 'Mensajeria',
        icon: 'solar:chat-round-dots-bold',
        collections: ['conversaciones_chat'],
        collectionGroups: ['mensajes'],
      }),
      readMetricGroup({
        name: 'Notificaciones',
        icon: 'solar:bell-bold',
        collections: [
          'notificaciones',
          'tipos_notificaciones',
          'plantillas_notificaciones',
          'preferencias_notificaciones',
          'tareas_notificaciones',
        ],
      }),
      readMetricGroup({
        name: 'Salud',
        icon: 'solar:heart-pulse-bold',
        collections: [
          'informacion_medica_basica_miembros',
          'medicamentos_miembros',
          'alergias_miembros',
          'condiciones_medicas_miembros',
          'documentos_salud_miembros',
        ],
      }),
    ]),
    readApiResponseMetric({
      name: 'API Miembros',
      icon: 'solar:users-group-rounded-bold',
      url: MEMBERS_API_URL,
    }),
    readMetricGroup({
      name: 'Logs API',
      icon: 'solar:server-bold',
      collections: ['apiLogs', 'api_logs', 'logs_api', 'metricas_api'],
    }),
  ]);

  const apiMetrics = [apiMembersMetric, apiLogMetric].filter(
    (metric) => metric.count || metric.bytes || metric.sources?.some((source) => !source.error)
  );
  const moduleCards = databaseMetrics.map((metric) => ({
    name: metric.name,
    type: 'Firestore',
    count: `${metric.count.toLocaleString()} registros`,
    size: metric.bytes,
    icon: metric.icon,
    sources: metric.sources,
  }));

  return Response.json({
    updatedAt: nowIso(),
    configured: Boolean(isFirebaseConfigured),
    views: {
      files: buildView({
        title: 'Actividad de archivos',
        storageTitle: 'Uso de storage',
        countLabel: 'elementos',
        total: GENERAL_STORAGE_BYTES,
        metrics: fileMetrics,
      }),
      api: buildView({
        title: 'Datos reales de API',
        storageTitle: 'Payloads y logs API',
        countLabel: 'elementos',
        total: GENERAL_STORAGE_BYTES,
        metrics: apiMetrics.length ? apiMetrics : [emptyMetric('Sin metricas API', 'solar:server-bold')],
      }),
      database: buildView({
        title: 'Datos reales de base de datos',
        storageTitle: 'Uso por coleccion',
        countLabel: 'registros',
        total: GENERAL_STORAGE_BYTES,
        metrics: databaseMetrics,
      }),
    },
    moduleCards,
  });
}
