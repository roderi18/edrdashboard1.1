export const getFileManagerShareLink = (item = {}) => {
  if (item.url) {
    return item.url;
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (item.type === 'folder' && item.id) {
    const params = new URLSearchParams({ folder: item.id });

    if (item.source === 'storage') {
      params.set('source', 'storage');
      params.set('view', 'grid');
    }

    return `${baseUrl}/dashboard/file-manager/?${params.toString()}`;
  }

  return `${baseUrl}/dashboard/file-manager/`;
};

export const getFileManagerShareLabel = (item = {}) =>
  item.name || item.title || 'Elemento compartido';
