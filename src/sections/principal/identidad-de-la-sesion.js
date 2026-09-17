// ----------------------------------------------------------------------
// QUIEN ES, SEGUN LA SESION, PARA LA BIENVENIDA DE LA PORTADA.
//
// Vivia dentro de `principal-home-view.jsx`. Salio a su archivo, sin cambiar una
// letra, porque EXPLORA Designer tambien lo necesita: la vista previa de la
// bienvenida tiene que saludar con el mismo nombre, destacamento y region que la
// portada de verdad, o lo que se ve al editar no seria lo que se publica.
// ----------------------------------------------------------------------

const nombreDeLaSesion = (user) =>
  user?.displayName ||
  [user?.nombres, user?.apellidos].filter(Boolean).join(' ').trim() ||
  user?.nombre ||
  user?.email ||
  'Explorador';

const destacamentoDeLaSesion = (user) => {
  const nombre =
    user?.nombreDestacamento || user?.destacamentoName || user?.destName || user?.destacamento;

  if (nombre) return String(nombre);

  const numero = user?.numeroDestacamento || user?.destNumber;

  return numero ? `Destacamento ${numero}` : '';
};

const regionDeLaSesion = (user) =>
  user?.nombreRegion || user?.regionName || user?.regionalName || user?.region || '';

/** Nombre, destacamento, region y foto de quien tiene la sesion abierta. */
export const identidadDeLaSesion = (user) => ({
  nombre: nombreDeLaSesion(user),
  destacamento: destacamentoDeLaSesion(user),
  region: regionDeLaSesion(user),
  foto: user?.photoURL || user?.avatarUrl || '',
});

/**
 * La region y el destacamento de la sesion, por su numero, para las campañas de
 * EXPLORA que van solo a una parte de la organizacion (fase 8). Sin dato, vacio:
 * una campaña acotada no le llega a quien no se sabe donde esta.
 */
export const alcanceDeLaSesion = (user) => ({
  idRegion: String(user?.regionId ?? user?.idRegion ?? user?.idRegional ?? '').trim(),
  idDestacamento: String(user?.idDestacamento ?? user?.destId ?? '').trim(),
});
