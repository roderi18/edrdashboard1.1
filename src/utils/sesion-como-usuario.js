const CLAVE = 'edr-sesion-como-usuario';
export const EVENTO_SESION_COMO_USUARIO = 'edr:sesion-como-usuario';

export const leerSesionComoUsuario = () => {
  if (typeof window === 'undefined') return null;

  try {
    return JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
  } catch {
    return null;
  }
};

export const guardarSesionComoUsuario = (miembro) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLAVE, JSON.stringify(miembro));
  window.dispatchEvent(new Event(EVENTO_SESION_COMO_USUARIO));
};

export const borrarSesionComoUsuario = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CLAVE);
  window.dispatchEvent(new Event(EVENTO_SESION_COMO_USUARIO));
};
