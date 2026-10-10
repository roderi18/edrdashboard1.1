import { rutaFacturaPdfOnerrd } from 'src/utils/certificado-onerrd.mjs';

import { responderPdfDeCertificado } from 'src/server/certificado-publico.mjs';
import { buscarCertificadoOnerrd } from 'src/server/certificado-onerrd-publico.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// EL PDF DE LA FACTURA DE UN CERTIFICADO ONERRD, guardado en Storage al
// emitirlo. Lo pide la página que abre el QR de la factura. Pública, pero solo
// con la clave del certificado (la misma: es el mismo registro).
// ----------------------------------------------------------------------

export async function GET(req, { params }) {
  const { numero } = await params;
  const url = new URL(req.url);
  const busqueda = await buscarCertificadoOnerrd(numero, url.searchParams.get('c'), {
    ruta: rutaFacturaPdfOnerrd,
  });
  return responderPdfDeCertificado(busqueda, {
    nombre: `Factura-ONERRD-${numero}.pdf`,
    descargar: !!url.searchParams.get('descargar'),
  });
}
