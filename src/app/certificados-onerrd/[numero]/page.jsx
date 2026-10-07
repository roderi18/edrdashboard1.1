import { urlDelPdfOnerrd, formatearFechaHoraOnerrd } from 'src/utils/certificado-onerrd.mjs';

import { CONFIG } from 'src/global-config';
import { buscarCertificadoOnerrd } from 'src/server/certificado-onerrd-publico.mjs';

import { CertificadoOnerrdPublico } from 'src/sections/certificates/onerrd/publico/certificado-onerrd-publico';

// ----------------------------------------------------------------------
// LO QUE ABRE EL CÓDIGO QR DEL CERTIFICADO ONERRD: el certificado guardado en
// Firebase, dentro de un contenedor que dice cuándo se generó.
//
// Pública (quien escanea el papel no tiene cuenta) y fuera de /dashboard, sin
// AuthGuard. La clave del QR se comprueba aquí, en el servidor, antes de pintar
// nada: el navegador no recibe ni el número del destacamento si no es la suya.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Certificado de Registro ONERRD - ${CONFIG.appName}`,
  // El enlace lleva la clave: que ningún buscador lo guarde.
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }) {
  const { numero } = await params;
  const { c: clave } = await searchParams;

  if (numero === 'prueba') return <CertificadoOnerrdPublico estado="prueba" />;

  const { estado, emitido } = await buscarCertificadoOnerrd(numero, clave);

  if (estado !== 'ok' && estado !== 'sin-pdf') return <CertificadoOnerrdPublico estado={estado} />;

  const valores = emitido.valores || {};

  return (
    <CertificadoOnerrdPublico
      estado={estado}
      numero={numero}
      generadoEn={formatearFechaHoraOnerrd(emitido.emitidoEnIso)}
      destacamento={[
        valores.numeroDestacamento && `N.º ${valores.numeroDestacamento}`,
        valores.nombreDestacamento,
      ]
        .filter(Boolean)
        .join(' · ')}
      urlPdf={urlDelPdfOnerrd(numero, clave)}
      urlDescarga={urlDelPdfOnerrd(numero, clave, { descargar: true })}
    />
  );
}
