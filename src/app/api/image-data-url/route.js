export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const isPrivateHost = (hostname) =>
  /^127\./.test(hostname) ||
  hostname === '::1' ||
  hostname.startsWith('10.') ||
  hostname.startsWith('192.168.') ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

export async function GET(req) {
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

  if (!['http:', 'https:'].includes(imageUrl.protocol) || isPrivateHost(imageUrl.hostname)) {
    return Response.json({ message: 'La URL de la imagen no esta permitida.' }, { status: 400 });
  }

  try {
    const imageResponse = await fetch(imageUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!imageResponse.ok) {
      return Response.json(
        { message: 'No se pudo leer la imagen del miembro.' },
        { status: imageResponse.status }
      );
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      return Response.json({ message: 'El archivo no es una imagen valida.' }, { status: 400 });
    }

    const contentLength = Number(imageResponse.headers.get('content-length') || 0);

    if (contentLength > MAX_IMAGE_BYTES) {
      return Response.json(
        { message: 'La imagen es demasiado pesada para el PDF.' },
        { status: 413 }
      );
    }

    const arrayBuffer = await imageResponse.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return Response.json(
        { message: 'La imagen es demasiado pesada para el PDF.' },
        { status: 413 }
      );
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return Response.json({ dataUrl: `data:${contentType};base64,${base64}` });
  } catch (error) {
    console.error('[image-data-url] failed to fetch image', error);

    return Response.json(
      { message: 'No se pudo preparar la imagen para el PDF.' },
      { status: 500 }
    );
  }
}
