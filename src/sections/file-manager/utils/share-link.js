export const getFileManagerShareLink = (item = {}) => {
  if (item.url) {
    return item.url;
  }

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3032';

  if (item.type === 'folder' && item.id) {
    return `${baseUrl}/dashboard/file-manager/?folder=${encodeURIComponent(item.id)}`;
  }

  return `${baseUrl}/dashboard/file-manager/`;
};

export const getFileManagerShareLabel = (item = {}) => item.name || item.title || 'Elemento compartido';
