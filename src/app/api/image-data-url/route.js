export const runtime = 'nodejs';

import { exigirSesionRest } from 'src/server/sesion-rest.mjs';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const ALLOWED_IMAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'systexploradores.somee.com',
  ...String(process.env.PDF_IMAGE_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
]);

export async function GET(req) {
  const sinSesion = await exigirSesionRest(req);
  if (sinSesion) return sinSesion;

  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return Response.json({ message: 'La URL de la imagen es obligatoria.' }, { status: 400 });
  }

  let imageUrl;

  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return Response.json({ message: 'La URL de la imagen no es valida.' }, { status: 400 });
  }

  if (imageUrl.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(imageUrl.hostname.toLowerCase())) {
    return Response.json({ message: 'La URL de la imagen no esta permitida.' }, { status: 400 });
  }

  try {
    const imageResponse = await fetch(imageUrl, {
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg',
      },
    });

    if (!imageResponse.ok) {
      return Response.json(
        { message: 'No se pudo leer la imagen del miembro.' },
        { status: imageResponse.status }
      );
    }

    const contentType = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase();

    if (!['image/avif', 'image/webp', 'image/png', 'image/jpeg'].includes(contentType)) {
      return Response.json({ message: 'El archivo no es una imagen valida.' }, { status: 400 });
    }

    const contentLength = Number(imageResponse.headers.get('content-length') || 0);

    if (contentLength > MAX_IMAGE_BYTES) {
      return Response.json(
        { message: 'La imagen es demasiado pesada para el PDF.' },
        { status: 413 }
      );
    }

    const reader = imageResponse.body?.getReader();
    if (!reader) throw new Error('La imagen no tiene contenido legible.');

    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return Response.json({ message: 'La imagen es demasiado pesada para el PDF.' }, { status: 413 });
      }
      chunks.push(value);
    }

    const base64 = Buffer.concat(chunks).toString('base64');

    return Response.json({ dataUrl: `data:${contentType};base64,${base64}` });
  } catch (error) {
    console.error('[image-data-url] failed to fetch image', error);

    return Response.json(
      { message: 'No se pudo preparar la imagen para el PDF.' },
      { status: 500 }
    );
  }
}
