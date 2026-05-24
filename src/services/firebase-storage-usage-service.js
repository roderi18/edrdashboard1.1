import { ref, listAll, getMetadata } from 'firebase/storage';
import { collection, getCountFromServer } from 'firebase/firestore';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

export const FIREBASE_STORAGE_LIMIT_BYTES = 5 * 1024 ** 3;

const CACHE_KEY = 'firebase-storage-usage-summary-es-v3';
const CACHE_TTL = 5 * 60 * 1000;
const METADATA_CONCURRENCY = 8;

const CATEGORY_DEFINITIONS = {
  images: { key: 'images', label: 'Imágenes' },
  media: { key: 'media', label: 'Multimedia' },
  documents: { key: 'documents', label: 'Documentos' },
  other: { key: 'other', label: 'Otros' },
};

const FILE_RECORD_COLLECTIONS = [
  'gestorArchivos',
  'documentos_salud_miembros',
  'certificados',
  'plantillasCertificados',
  'lotesCertificados',
  'certificateTemplates',
  'certificateBatches',
  'vinculosCertificadosAscenso',
];

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'avif',
  'bmp',
  'ico',
]);
const MEDIA_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
]);
const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'rtf',
]);

const createEmptyCategory = (definition) => ({
  ...definition,
  usedStorage: 0,
  filesCount: 0,
});

export const createEmptyStorageUsageSummary = () => {
  const categories = Object.fromEntries(
    Object.values(CATEGORY_DEFINITIONS).map((definition) => [
      definition.key,
      createEmptyCategory(definition),
    ])
  );

  return {
    limitBytes: FIREBASE_STORAGE_LIMIT_BYTES,
    usedBytes: 0,
    availableBytes: FIREBASE_STORAGE_LIMIT_BYTES,
    percentUsed: 0,
    totalFiles: 0,
    recordsCount: 0,
    categories,
    folders: [],
    fileManagerItems: [],
    recentFiles: [],
    activityChart: buildActivityChart([]),
    generatedAt: null,
    fromCache: false,
    error: '',
  };
};

const getExtension = (path = '') =>
  String(path || '')
    .split('?')[0]
    .split('#')[0]
    .split('.')
    .pop()
    ?.toLowerCase() || '';

const classifyStorageFile = ({ contentType = '', fullPath = '', name = '' } = {}) => {
  const mime = String(contentType || '').toLowerCase();
  const extension = getExtension(name || fullPath);

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'images';
  if (mime.startsWith('video/') || mime.startsWith('audio/') || MEDIA_EXTENSIONS.has(extension)) {
    return 'media';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.startsWith('text/') ||
    DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return 'documents';
  }

  return 'other';
};

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const runPool = async (items, concurrency, task) => {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;

      results[currentIndex] = await task(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));

  return results;
};

const listStorageItemsRecursive = async (folderRef) => {
  const result = await listAll(folderRef);
  const itemMetadata = await runPool(result.items, METADATA_CONCURRENCY, async (itemRef) => {
    const metadata = await getMetadata(itemRef);

    return {
      id: metadata.fullPath,
      name: metadata.name || itemRef.name,
      fullPath: metadata.fullPath,
      contentType: metadata.contentType || '',
      size: toNumber(metadata.size),
      timeCreated: metadata.timeCreated || '',
      updated: metadata.updated || metadata.timeCreated || '',
      customMetadata: metadata.customMetadata || {},
    };
  });
  const nestedItems = await runPool(result.prefixes, 3, (prefixRef) =>
    listStorageItemsRecursive(prefixRef)
  );

  return [...itemMetadata, ...nestedItems.flat()];
};

const getYear = (item) => {
  const date = new Date(item.updated || item.timeCreated || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
};

const getMonth = (item) => {
  const date = new Date(item.updated || item.timeCreated || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().getMonth() : date.getMonth();
};

const getWeekBucket = (item) => {
  const date = new Date(item.updated || item.timeCreated || Date.now());
  if (Number.isNaN(date.getTime())) return 4;

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(4, 4 - Math.floor(diffDays / 7)));
};

function buildSeriesFromItems({ items, categories, getBucket, labels }) {
  return Object.values(CATEGORY_DEFINITIONS).map((definition) => ({
    name: definition.label,
    data: categories.map((categoryValue) =>
      items
        .filter(
          (item) =>
            item.category === definition.key && String(getBucket(item)) === String(categoryValue)
        )
        .reduce((total, item) => total + item.size, 0)
    ),
  }));
}

function buildActivityChart(items) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 6 }, (_, index) => currentYear - 5 + index);
  const monthIndexes = Array.from({ length: 12 }, (_, index) => index);
  const monthLabels = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  const weekBuckets = [0, 1, 2, 3, 4];

  return {
    series: [
      {
        name: 'Semanal',
        categories: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'],
        data: buildSeriesFromItems({
          items,
          categories: weekBuckets,
          getBucket: getWeekBucket,
        }),
      },
      {
        name: 'Mensual',
        categories: monthLabels,
        data: buildSeriesFromItems({
          items: items.filter((item) => getYear(item) === currentYear),
          categories: monthIndexes,
          getBucket: getMonth,
        }),
      },
      {
        name: 'Anual',
        categories: years.map(String),
        data: buildSeriesFromItems({
          items,
          categories: years,
          getBucket: getYear,
        }),
      },
    ],
  };
}

const getRootFolderName = (fullPath = '') =>
  String(fullPath || '').includes('/') ? String(fullPath).split('/')[0] : 'Raíz';

const buildFolders = (items) => {
  const foldersByName = new Map();

  items.forEach((item) => {
    const folderName = getRootFolderName(item.fullPath);
    const folder = foldersByName.get(folderName) || {
      id: folderName,
      name: folderName,
      type: 'folder',
      source: 'storage',
      size: 0,
      totalFiles: 0,
      updatedAt: item.updated,
      modifiedAt: item.updated,
      shared: [],
      tags: [],
      isFavorited: false,
    };

    folder.size += item.size;
    folder.totalFiles += 1;
    folder.updatedAt =
      new Date(item.updated || 0) > new Date(folder.updatedAt || 0)
        ? item.updated
        : folder.updatedAt;
    folder.modifiedAt = folder.updatedAt;
    foldersByName.set(folderName, folder);
  });

  return Array.from(foldersByName.values()).sort((a, b) => b.size - a.size);
};

const mapStorageItemToFileManagerItem = (item) => ({
  id: item.fullPath,
  name: item.name,
  type: getExtension(item.name || item.fullPath) || 'file',
  source: 'storage',
  url: '',
  parentId: getRootFolderName(item.fullPath),
  shared: [],
  tags: [],
  size: item.size,
  totalFiles: 0,
  createdAt: item.timeCreated,
  modifiedAt: item.updated || item.timeCreated,
  isFavorited: false,
  storagePath: item.fullPath,
  contentType: item.contentType,
});

const buildFileManagerItems = (items) => [
  ...buildFolders(items),
  ...items.map(mapStorageItemToFileManagerItem),
];

const buildRecentFiles = (items) =>
  [...items]
    .sort((a, b) => new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime())
    .slice(0, 8)
    .map((item) => ({
      id: item.fullPath,
      name: item.name,
      type: getExtension(item.name || item.fullPath),
      source: 'storage',
      url: '',
      parentId: getRootFolderName(item.fullPath),
      shared: [],
      tags: [],
      size: item.size,
      totalFiles: 0,
      createdAt: item.timeCreated,
      modifiedAt: item.updated || item.timeCreated,
      isFavorited: false,
      storagePath: item.fullPath,
      contentType: item.contentType,
    }));

const countFirestoreRecords = async () => {
  if (!FIRESTORE) return { total: 0, byCollection: [] };

  const byCollection = await Promise.all(
    FILE_RECORD_COLLECTIONS.map(async (collectionName) => {
      try {
        const snapshot = await getCountFromServer(collection(FIRESTORE, collectionName));
        return { collectionName, count: snapshot.data().count || 0 };
      } catch {
        return { collectionName, count: 0 };
      }
    })
  );

  return {
    total: byCollection.reduce((total, item) => total + item.count, 0),
    byCollection,
  };
};

const summarizeStorageItems = async (items) => {
  const categories = Object.fromEntries(
    Object.values(CATEGORY_DEFINITIONS).map((definition) => [
      definition.key,
      createEmptyCategory(definition),
    ])
  );
  const categorizedItems = items.map((item) => ({ ...item, category: classifyStorageFile(item) }));

  categorizedItems.forEach((item) => {
    categories[item.category].usedStorage += item.size;
    categories[item.category].filesCount += 1;
  });

  const records = await countFirestoreRecords();
  const usedBytes = categorizedItems.reduce((total, item) => total + item.size, 0);

  return {
    limitBytes: FIREBASE_STORAGE_LIMIT_BYTES,
    usedBytes,
    availableBytes: Math.max(0, FIREBASE_STORAGE_LIMIT_BYTES - usedBytes),
    percentUsed: Math.min(100, Math.round((usedBytes / FIREBASE_STORAGE_LIMIT_BYTES) * 100)),
    totalFiles: categorizedItems.length,
    recordsCount: records.total,
    recordsByCollection: records.byCollection,
    categories,
    folders: buildFolders(categorizedItems),
    fileManagerItems: buildFileManagerItems(categorizedItems),
    recentFiles: buildRecentFiles(categorizedItems),
    activityChart: buildActivityChart(categorizedItems),
    generatedAt: new Date().toISOString(),
    fromCache: false,
    error: '',
  };
};

let latestSummary = null;

const isFreshSummary = (summary) => {
  if (!summary?.generatedAt) return false;

  const age = Date.now() - new Date(summary.generatedAt).getTime();

  return age <= CACHE_TTL;
};

const readCache = () => {
  if (isFreshSummary(latestSummary)) {
    return { ...latestSummary, fromCache: true };
  }

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isFreshSummary(parsed)) return null;

    latestSummary = parsed;
    return { ...parsed, fromCache: true };
  } catch {
    return null;
  }
};

const writeCache = (summary) => {
  latestSummary = summary;

  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(summary));
  } catch {
    // Cache is an optimization only.
  }
};

let currentRequest = null;

export async function getFirebaseStorageUsageSummary({ force = false } = {}) {
  if (!isFirebaseConfigured || !FIREBASE_STORAGE) {
    return {
      ...createEmptyStorageUsageSummary(),
      error: 'Firebase no esta configurado en este entorno.',
    };
  }

  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }

  if (currentRequest && !force) return currentRequest;

  currentRequest = listStorageItemsRecursive(ref(FIREBASE_STORAGE))
    .then(summarizeStorageItems)
    .then((summary) => {
      writeCache(summary);
      return summary;
    })
    .finally(() => {
      currentRequest = null;
    });

  return currentRequest;
}
