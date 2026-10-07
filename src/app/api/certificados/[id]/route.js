import { responderPdfDeCertificado } from 'src/server/certificado-publico.mjs';
import { buscarCertificadoPublico } from 'src/server/certificado-curso-publico.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// EL PDF DE UN CERTIFICADO DE "CREAR CERTIFICADOS", guardado en Storage.
//
// El QR abre `/certificados/<id>?c=CLAVE` (el contenedor con la fecha y hora
// de generación); esa página pide aquí el PDF. Pública, pero solo con la clave
// del certificado. Lee con el Admin SDK.
// ----------------------------------------------------------------------

export async function GET(req, { params }) {
  const { id } = await params;
  const url = new URL(req.url);
  const busqueda = await buscarCertificadoPublico(id, url.searchParams.get('c'));
  return responderPdfDeCertificado(busqueda, {
    nombre: busqueda.certificado?.nombreArchivo || `${id}.pdf`,
    descargar: !!url.searchParams.get('descargar'),
  });
}
