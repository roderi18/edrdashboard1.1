import { responderPdfDeCertificado } from 'src/server/certificado-publico.mjs';
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

export async function GET(req, { params }) {
  const { numero } = await params;
  const url = new URL(req.url);
  const busqueda = await buscarCertificadoOnerrd(numero, url.searchParams.get('c'));
  return responderPdfDeCertificado(busqueda, {
    nombre: `ONERRD-${numero}.pdf`,
    descargar: !!url.searchParams.get('descargar'),
  });
}
