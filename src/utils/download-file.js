export async function downloadFileFromUrl(url, fileName = 'archivo') {
  if (!url) return;

  const downloadFromBlob = (blob) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('No se pudo leer el archivo.');
    }

    downloadFromBlob(await response.blob());
  } catch {
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
