import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

const MEMBER_DIVISION_GROUP = 'memberDivisions';
const SECTIONAL_GROUP = 'sectionals';
const REGIONAL_GROUP = 'regionals';

export const COVER_PHOTOS_COLLECTION = 'cover_photos';

export const COVER_PHOTO_GROUPS = [
  {
    value: MEMBER_DIVISION_GROUP,
    label: 'Divisiones',
    title: 'Divisiones de miembros',
    description: 'Estas portadas se muestran en las tarjetas de miembros y administradores.',
  },
  {
    value: 'dests',
    label: 'Destacamentos',
    title: 'Destacamentos',
    description: 'Portadas para los destacamentos.',
  },
  {
    value: SECTIONAL_GROUP,
    label: 'Secciones',
    title: 'Secciones',
    description: 'Portadas para las secciones.',
  },
  {
    value: REGIONAL_GROUP,
    label: 'Regiones',
    title: 'Regiones',
    description: 'Portadas para las regiones.',
  },
];

export const MEMBER_DIVISION_COVER_ITEMS = [
  {
    id: 'exploradores',
    name: 'Exploradores',
    defaultSrc: '/assets/images/divisions/member/exploradores3.jpg',
  },
  {
    id: 'seguidores',
    name: 'Seguidores',
    defaultSrc: '/assets/images/divisions/member/seguidores.jpg',
  },
  {
    id: 'pioneros',
    name: 'Pioneros',
    defaultSrc: '/assets/images/divisions/member/pioneros.jpg',
  },
  {
    id: 'navegantes',
    name: 'Navegantes',
    defaultSrc: '/assets/images/divisions/member/navegantes2.jpg',
  },
  {
    id: 'liderazgo',
    name: 'Liderazgo',
    defaultSrc: '/assets/images/divisions/member/liderazgo.jpg',
  },
];

export const DEFAULT_COVER_PHOTO_SRC = '/assets/images/divisions/member/default.jpg';
export const DEFAULT_COVER_PHOTO_POSITION = {
  positionX: 50,
  positionY: 50,
  scale: 1,
};

const normalizeKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getCoverConfigKeys = (...values) =>
  values
    .flat()
    .map((value) => String(value || '').trim())
    .filter(Boolean);

let coverPhotoOverridesCache = null;
let coverPhotoOverridesRequest = null;

export const getCoverPhotoOverrides = () => coverPhotoOverridesCache || {};

const persistCoverPhotoOverrides = (overrides) => {
  coverPhotoOverridesCache = overrides;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('coverPhotosUpdated', { detail: overrides }));
  }

  return overrides;
};

const getDocumentId = ({ group, id }) => `${group}_${id}`;

const normalizeCoverPhotoConfig = (value, defaultSrc = DEFAULT_COVER_PHOTO_SRC) => {
  if (typeof value === 'string') {
    return {
      src: value || defaultSrc,
      ...DEFAULT_COVER_PHOTO_POSITION,
    };
  }

  return {
    src: value?.src || value?.urlFoto || defaultSrc,
    name: value?.name || '',
    positionX: Number(value?.positionX ?? DEFAULT_COVER_PHOTO_POSITION.positionX),
    positionY: Number(value?.positionY ?? DEFAULT_COVER_PHOTO_POSITION.positionY),
    scale: Number(value?.scale ?? DEFAULT_COVER_PHOTO_POSITION.scale),
  };
};

export const getCoverPhotoConfig = ({ group, id, ids = [], defaultSrc }) => {
  const overrides = coverPhotoOverridesCache || getCoverPhotoOverrides();
  const groupOverrides = overrides?.[group] || {};
  const keys = getCoverConfigKeys(id, ids);
  const override = keys.reduce((matchedOverride, key) => {
    if (matchedOverride) return matchedOverride;

    return groupOverrides[key] || groupOverrides[normalizeKey(key)];
  }, null);

  return normalizeCoverPhotoConfig(override, defaultSrc || DEFAULT_COVER_PHOTO_SRC);
};

export const getCoverPhotoSrc = ({ group, id, defaultSrc }) => {
  const config = getCoverPhotoConfig({ group, id, defaultSrc });

  return config.src;
};

export const getCoverPhotoImageSx = (config) => {
  const normalizedConfig = normalizeCoverPhotoConfig(config);

  return {
    objectPosition: `${normalizedConfig.positionX}% ${normalizedConfig.positionY}%`,
    transform: `scale(${normalizedConfig.scale})`,
    transformOrigin: `${normalizedConfig.positionX}% ${normalizedConfig.positionY}%`,
  };
};

export const fetchCoverPhotoOverrides = async ({ force = false } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    coverPhotoOverridesCache = {};
    return {};
  }

  if (coverPhotoOverridesCache && !force) return coverPhotoOverridesCache;
  if (coverPhotoOverridesRequest && !force) return coverPhotoOverridesRequest;

  coverPhotoOverridesRequest = getDocs(collection(FIRESTORE, COVER_PHOTOS_COLLECTION))
    .then((snapshot) => {
      const overrides = {};

      snapshot.docs.forEach((coverDoc) => {
        const data = coverDoc.data();

        if (data.estado !== 'activo' || !data.group || !data.id || !data.urlFoto) return;

        overrides[data.group] = {
          ...(overrides[data.group] || {}),
          [data.id]: normalizeCoverPhotoConfig(data, data.urlFoto),
        };

        if (data.name) {
          overrides[data.group][normalizeKey(data.name)] = normalizeCoverPhotoConfig(
            data,
            data.urlFoto
          );
        }
      });

      coverPhotoOverridesCache = persistCoverPhotoOverrides(overrides);

      return overrides;
    })
    .catch(() => {
      coverPhotoOverridesCache = coverPhotoOverridesCache || {};

      return coverPhotoOverridesCache;
    })
    .finally(() => {
      coverPhotoOverridesRequest = null;
    });

  return coverPhotoOverridesRequest;
};

export const uploadCoverPhotoOverride = async ({
  group,
  id,
  name,
  file,
  positionX,
  positionY,
  scale,
}) => {
  if (!file) throw new Error('Selecciona una imagen de portada.');

  const positionConfig = {
    positionX: Number(positionX ?? DEFAULT_COVER_PHOTO_POSITION.positionX),
    positionY: Number(positionY ?? DEFAULT_COVER_PHOTO_POSITION.positionY),
    scale: Number(scale ?? DEFAULT_COVER_PHOTO_POSITION.scale),
  };

  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase debe estar configurado para guardar fotos de portada.');
  }

  const uploadResult = await uploadOptimizedImage({
    file,
    preset: 'cover',
    storagePath: `cover-photos/${group}/${id}/cover.webp`,
    metadata: {
      group,
      id,
      name: name || '',
      positionX: String(positionConfig.positionX),
      positionY: String(positionConfig.positionY),
      scale: String(positionConfig.scale),
    },
  });

  const documentId = getDocumentId({ group, id });
  const payload = {
    id,
    group,
    name: name || '',
    estado: 'activo',
    urlFoto: uploadResult.downloadUrl,
    rutaArchivo: uploadResult.storagePath,
    ...positionConfig,
    actualizadoEn: serverTimestamp(),
  };

  await setDoc(
    doc(FIRESTORE, COVER_PHOTOS_COLLECTION, documentId),
    {
      ...payload,
      creadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  return saveCoverPhotoOverride({
    group,
    id,
    name,
    src: uploadResult.downloadUrl,
    ...positionConfig,
  });
};

export const saveCoverPhotoOverride = ({ group, id, name, src, positionX, positionY, scale }) => {
  const overrides = coverPhotoOverridesCache || {};
  const config = normalizeCoverPhotoConfig(
    {
      src,
      positionX,
      positionY,
      scale,
    },
    src
  );
  const nextOverrides = {
    ...overrides,
    [group]: {
      ...(overrides[group] || {}),
      [id]: config,
    },
  };

  if (name) {
    nextOverrides[group][normalizeKey(name)] = config;
  }

  coverPhotoOverridesCache = persistCoverPhotoOverrides(nextOverrides);

  return coverPhotoOverridesCache;
};

export const resetCoverPhotoOverride = async ({ group, id, name }) => {
  if (isFirebaseConfigured && FIRESTORE) {
    await setDoc(
      doc(FIRESTORE, COVER_PHOTOS_COLLECTION, getDocumentId({ group, id })),
      {
        id,
        group,
        estado: 'inactivo',
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  }

  const overrides = coverPhotoOverridesCache || {};
  const groupOverrides = { ...(overrides[group] || {}) };

  delete groupOverrides[id];
  if (name) delete groupOverrides[normalizeKey(name)];

  const nextOverrides = {
    ...overrides,
    [group]: groupOverrides,
  };

  coverPhotoOverridesCache = persistCoverPhotoOverrides(nextOverrides);

  return coverPhotoOverridesCache;
};

export const getMemberDivisionCoverConfig = (memberDivision) => {
  const divisionKey = normalizeKey(memberDivision);
  const item = MEMBER_DIVISION_COVER_ITEMS.find(
    (coverItem) => normalizeKey(coverItem.name) === divisionKey || coverItem.id === divisionKey
  );

  if (!item) {
    return normalizeCoverPhotoConfig(null, DEFAULT_COVER_PHOTO_SRC);
  }

  return getCoverPhotoConfig({
    group: MEMBER_DIVISION_GROUP,
    id: item.id,
    defaultSrc: item.defaultSrc,
  });
};

export const getMemberDivisionCoverSrc = (memberDivision) =>
  getMemberDivisionCoverConfig(memberDivision).src;

export const memberDivisionCoverGroup = MEMBER_DIVISION_GROUP;
export const sectionalCoverGroup = SECTIONAL_GROUP;
export const regionalCoverGroup = REGIONAL_GROUP;
