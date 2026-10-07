import { buscarCertificadoOnerrd } from 'src/server/certificado-onerrd-publico.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// EL PDF DE UN CERTIFICADO ONERRD EMITIDO, guardado en Storage al emitirlo.
//
// El QR no viene aquí: abre `/certificados-onerrd/AAAA-NNN?c=CLAVE`, la página
// que lo enseña dentro de su contenedor con la fecha y hora de generación, y
// esa página pide el PDF a esta ruta (y la usa para "Descargar").
//
// Es pública (quien escanea el papel no tiene cuenta), pero solo entrega un
// certificado con su clave. Lee con el Admin SDK: en `storage.rules` la carpeta
// no la lee nadie desde el navegador.
// ----------------------------------------------------------------------

const texto = (mensaje, status) =>
  new Response(mensaje, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function GET(req, { params }) {
  const { numero } = await params;
  const url = new URL(req.url);

  const { estado, archivo } = await buscarCertificadoOnerrd(numero, url.searchParams.get('c'));

  if (estado === 'no-disponible') return texto('Servicio no disponible.', 503);
  if (estado !== 'ok') return texto('Certificado no encontrado.', 404);

  try {
    const [bytes] = await archivo.download();
    const modo = url.searchParams.get('descargar') ? 'attachment' : 'inline';

    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${modo}; filename="ONERRD-${numero}.pdf"`,
        'content-length': String(bytes.length),
        // Privado: el enlace lleva la clave y no debe quedar en cachés compartidas.
        'cache-control': 'private, max-age=300',
        'x-robots-tag': 'noindex',
      },
    });
  } catch (error) {
    console.error('[certificados-onerrd] no se pudo leer el PDF', error);
    return texto('Servicio no disponible.', 503);
  }
}
