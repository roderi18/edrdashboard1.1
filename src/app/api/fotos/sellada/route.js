import sharp from 'sharp';

import { exigirSesionRest } from 'src/server/sesion-rest.mjs';

// ----------------------------------------------------------------------
// La foto con el escudo DENTRO del archivo.
//
// En pantalla el sello se pinta encima con CSS, y con eso basta para verlo. Pero
// al descargar, esa capa no viaja: lo que se guarda es la foto pelada. Aqui se
// compone de verdad, en el servidor.
//
// No se hace en el navegador a proposito: dibujar en un lienzo una imagen de
// otro dominio lo deja "manchado" y el navegador prohibe exportarlo, salvo que
// Storage mande cabeceras de CORS que hoy no manda.
// ----------------------------------------------------------------------

// Solo se traen fotos de nuestro propio almacenamiento. Sin esta lista, la ruta
// seria un mensajero a sueldo: cualquiera podria pedirle que fuera a buscar algo
// a una direccion interna y se lo devolviera.
const ORIGENES_PERMITIDOS = new Set(['firebasestorage.googleapis.com']);

const SELLO = '/icon-512x512.png';

// Cuanto ocupa el sello respecto al lado corto, con topes para que no se coma
// una foto pequeña ni desaparezca en una enorme.
const PROPORCION_SELLO = 0.16;
const SELLO_MINIMO = 72;
const SELLO_MAXIMO = 260;
const MARGEN = 0.03;

let selloEnMemoria = null;

/** El escudo, recortado en circulo. Se prepara una vez por instancia. */
const traerSello = async (origen) => {
  if (selloEnMemoria) return selloEnMemoria;

  const respuesta = await fetch(new URL(SELLO, origen));

  if (!respuesta.ok) throw new Error('No se pudo leer el escudo.');

  const bruto = Buffer.from(await respuesta.arrayBuffer());
  const { width = 512 } = await sharp(bruto).metadata();
  const mascara = Buffer.from(
    `<svg width="${width}" height="${width}"><circle cx="${width / 2}" cy="${width / 2}" r="${width / 2}" fill="white"/></svg>`
  );

  // El icono viene con las esquinas en blanco. Sobre una foto eso seria un
  // recuadro claro alrededor del escudo, asi que se recorta en circulo.
  selloEnMemoria = await sharp(bruto)
    .resize(width, width, { fit: 'cover' })
    .composite([{ input: mascara, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return selloEnMemoria;
};

export async function GET(req) {
  try {
    const noAutorizado = await exigirSesionRest(req);

    if (noAutorizado) return noAutorizado;

    const peticion = new URL(req.url);
    const direccion = peticion.searchParams.get('url') || '';

    let foto;

    try {
      foto = new URL(direccion);
    } catch {
      return Response.json({ error: 'Esa dirección no es válida.' }, { status: 400 });
    }

    if (!ORIGENES_PERMITIDOS.has(foto.hostname)) {
      return Response.json(
        { error: 'Solo se pueden sellar fotos de este sistema.' },
        { status: 400 }
      );
    }

    const original = await fetch(foto.toString());

    if (!original.ok) {
      return Response.json({ error: 'No se pudo traer la foto.' }, { status: 502 });
    }

    const datos = Buffer.from(await original.arrayBuffer());
    const imagen = sharp(datos, { failOn: 'none' }).rotate();
    const { width = 0, height = 0 } = await imagen.metadata();

    if (!width || !height) {
      return Response.json({ error: 'Ese archivo no es una imagen.' }, { status: 400 });
    }

    const ladoCorto = Math.min(width, height);
    const lado = Math.round(
      Math.max(SELLO_MINIMO, Math.min(SELLO_MAXIMO, ladoCorto * PROPORCION_SELLO))
    );
    const margen = Math.round(ladoCorto * MARGEN);
    const sello = await sharp(await traerSello(peticion.origin))
      .resize(lado, lado)
      .toBuffer();

    const sellada = await imagen
      .composite([
        {
          input: sello,
          top: Math.max(0, height - lado - margen),
          left: Math.max(0, width - lado - margen),
        },
      ])
      .webp({ quality: 88 })
      .toBuffer();

    const nombre = (peticion.searchParams.get('nombre') || 'foto')
      .replace(/[^\w\s-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    return new Response(sellada, {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Disposition': `attachment; filename="${nombre || 'foto'}.webp"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[fotos/sellada] no se pudo sellar la foto', error);

    return Response.json({ error: 'No se pudo preparar la descarga.' }, { status: 500 });
  }
}
