export const FILE_TYPE_OPTIONS = [
  'folder',
  'txt',
  'zip',
  'audio',
  'image',
  'video',
  'word',
  'excel',
  'powerpoint',
  'pdf',
  'photoshop',
  'illustrator',
];

// ----------------------------------------------------------------------

const ROOT_FOLDERS = [
  'Actividades al aire libre',
  'Actividades de destacamento',
  'Artes gráficas',
  'Formulario para líderes',
  'Formularios para muchachos',
  'Recursos varios',
];

const toFolderId = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const _folders = ROOT_FOLDERS.map((name, index) => ({
  id: toFolderId(name),
  name,
  type: 'folder',
  url: '',
  parentId: null,
  shared: [],
  tags: [],
  size: 0,
  totalFiles: 0,
  createdAt: new Date(2026, 4, index + 1).toISOString(),
  modifiedAt: new Date(2026, 4, index + 1).toISOString(),
  isFavorited: false,
}));

export const _files = [];

export const _allFiles = [..._folders, ..._files];
