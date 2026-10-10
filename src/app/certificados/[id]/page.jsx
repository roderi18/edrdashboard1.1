import { urlDelPdfPublico, formatearFechaHoraCertificado } from 'src/utils/certificado-publico.mjs';

import { CONFIG } from 'src/global-config';
import { buscarCertificadoPublico } from 'src/server/certificado-curso-publico.mjs';

import { CertificadoPublico } from 'src/sections/certificates/publico/certificado-publico';

// ----------------------------------------------------------------------
// LO QUE ABRE EL CÓDIGO QR DE UN CERTIFICADO DE "CREAR CERTIFICADOS": el mismo
// contenedor que el del ONERRD (qué certificado es, a quién se otorgó y cuándo
// se generó, con el PDF guardado dentro).
//
// Pública y fuera de /dashboard. La clave se comprueba en el servidor antes de
// pintar nada.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Certificado - ${CONFIG.appName}`,
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { c: clave } = await searchParams;

  const { estado, certificado } = await buscarCertificadoPublico(id, clave);

  if (estado !== 'ok') return <CertificadoPublico estado={estado} />;

  return (
    <CertificadoPublico
      estado="ok"
      titulo={certificado.tituloCertificado || certificado.nombreCurso || 'Certificado'}
      detalle={certificado.nombreMiembro ? `Otorgado a ${certificado.nombreMiembro}` : ''}
      generadoEn={formatearFechaHoraCertificado(certificado.creadoEn)}
      urlPdf={urlDelPdfPublico(id, clave)}
      urlDescarga={urlDelPdfPublico(id, clave, { descargar: true })}
    />
  );
}
