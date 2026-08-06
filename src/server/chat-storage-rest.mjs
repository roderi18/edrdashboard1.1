const SAFE_CHAT_STORAGE_PATH = /^chat\/[^/]+\/(imagenes|archivos)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/;

export const deleteChatStorageObjects = async ({
  bucket,
  token,
  paths = [],
  fetchImpl = fetch,
} = {}) => {
  const normalizedBucket = String(bucket ?? '').trim();
  const normalizedToken = String(token ?? '').trim();
  const safePaths = Array.from(
    new Set(paths.map((path) => String(path ?? '').trim()).filter((path) => SAFE_CHAT_STORAGE_PATH.test(path)))
  );

  if (!normalizedBucket || !normalizedToken || typeof fetchImpl !== 'function') {
    throw new TypeError('La limpieza de Storage requiere bucket, token y fetch.');
  }

  const results = await Promise.all(
    safePaths.map(async (path) => {
      const response = await fetchImpl(
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(normalizedBucket)}/o/${encodeURIComponent(path)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${normalizedToken}` },
          cache: 'no-store',
        }
      );

      return { path, ok: response.ok || response.status === 404, status: response.status };
    })
  );

  return {
    deleted: results.filter((result) => result.ok).map((result) => result.path),
    failed: results.filter((result) => !result.ok),
  };
};
