// ----------------------------------------------------------------------
// LA DIRECCIÓN PÚBLICA DE LA APLICACIÓN en cada ambiente, para enlaces que
// salen de la pantalla (el QR del certificado ONERRD va impreso en papel).
//
// Antes se usaba la de la pestaña: un certificado emitido desde `localhost`
// llevaba un QR a `localhost`, que en el móvil de quien lo escanea no abre
// nada. Ahora manda el proyecto de Firebase: los datos (y el PDF) viven en ese
// proyecto, y su App Hosting es quien los sabe entregar. Así un certificado
// emitido en local con los datos de dev abre la de dev, y lo mismo en qa y prod.
//
// Orden: `NEXT_PUBLIC_URL_PUBLICA` si está puesta (un dominio propio) → la del
// proyecto → la de la pestaña si no es local → ''.
// ----------------------------------------------------------------------

export const DIRECCIONES_PUBLICAS = Object.freeze({
  'systexploradores-dev': 'https://expedition-dev--systexploradores-dev.us-central1.hosted.app',
  'systexploradores-qa': 'https://expedition-qa--systexploradores-qa.us-central1.hosted.app',
  systexploradores: 'https://explora--systexploradores.us-central1.hosted.app',
});

const esLocal = (origen) => {
  try {
    const { hostname } = new URL(origen);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return true;
  }
};

const sinBarraFinal = (url) => String(url || '').replace(/\/+$/, '');

export const direccionPublica = ({ configurada, proyecto, origenActual } = {}) => {
  if (configurada && !esLocal(configurada)) return sinBarraFinal(configurada);
  if (DIRECCIONES_PUBLICAS[proyecto]) return DIRECCIONES_PUBLICAS[proyecto];
  if (origenActual && !esLocal(origenActual)) return sinBarraFinal(origenActual);
  return '';
};

// La de este ambiente, vista desde el navegador: el proyecto de Firebase con
// que se compiló y la pestaña como último recurso.
export const direccionPublicaActual = () => {
  const origenActual = typeof window === 'undefined' ? '' : window.location.origin;
  return (
    direccionPublica({
      configurada: process.env.NEXT_PUBLIC_URL_PUBLICA,
      proyecto: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      origenActual,
    }) || origenActual
  );
};
