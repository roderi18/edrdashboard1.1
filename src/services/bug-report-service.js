import { AUTH } from 'src/lib/firebase';

export const enviarReporteProblema = async ({ mensaje, ruta = '' } = {}) => {
  const token = await AUTH?.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

  // El reporte es un envío de soporte, no una mutación sobre una entidad de la
  // plataforma; su endpoint valida Firebase Auth y distribuye como Sistema.

  const response = await fetch('/api/reportar-problema', {
    // eslint-disable-next-line no-restricted-syntax
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mensaje: String(mensaje || '').trim(), ruta }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo enviar el reporte.');
  return result;
};
