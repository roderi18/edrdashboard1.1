import { formatearFechaHoraCertificado } from 'src/utils/certificado-publico.mjs';
import { rutaFacturaPdfOnerrd, urlDelPdfFacturaOnerrd } from 'src/utils/certificado-onerrd.mjs';

import { CONFIG } from 'src/global-config';
import { buscarCertificadoOnerrd } from 'src/server/certificado-onerrd-publico.mjs';

import { CertificadoPublico } from 'src/sections/certificates/publico/certificado-publico';

// ----------------------------------------------------------------------
// LO QUE ABRE EL CÓDIGO QR DE LA FACTURA ONERRD: la factura guardada en
// Firebase, en el mismo contenedor que el certificado (qué es, su número y
// cuándo se generó). La clave se comprueba en el servidor antes de pintar nada.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Factura ONERRD - ${CONFIG.appName}`,
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }) {
  const { numero } = await params;
  const { c: clave } = await searchParams;

  const { estado, emitido } = await buscarCertificadoOnerrd(numero, clave, {
    ruta: rutaFacturaPdfOnerrd,
  });

  if (estado !== 'ok') return <CertificadoPublico estado={estado} />;

  const numeroFactura = emitido.factura?.numero;
  return (
    <CertificadoPublico
      estado="ok"
      etiqueta="Factura emitida"
      titulo="Factura ONERRD"
      detalle={`N.º ${numeroFactura || '—'} · Certificado ${numero}`}
      generadoEn={formatearFechaHoraCertificado(emitido.emitidoEnIso)}
      urlPdf={urlDelPdfFacturaOnerrd(numero, clave)}
      urlDescarga={urlDelPdfFacturaOnerrd(numero, clave, { descargar: true })}
    />
  );
}
