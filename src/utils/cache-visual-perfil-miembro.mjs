// Cache de sesion para lo que ya se pinto en la tarjeta del miembro. Al cambiar
// de pestaña, App Router desmonta General; conservar aqui el ultimo valor evita
// volver a los esqueletos mientras Firestore confirma el dato actualizado.
const insigniasPorTipo = {
  cintas: new Map(),
  medallas: new Map(),
  pines: new Map(),
};

const imagenesResueltas = new Set();

const claveDeMiembro = (idMiembros) => String(Number(idMiembros) || '');

export function leerInsigniasDelPerfilEnCache(tipo, idMiembros) {
  const cache = insigniasPorTipo[tipo];
  const id = claveDeMiembro(idMiembros);

  if (!cache || !id || !cache.has(id)) return undefined;

  return cache.get(id);
}

export function recordarInsigniasDelPerfil(tipo, idMiembros, insignias = []) {
  const cache = insigniasPorTipo[tipo];
  const id = claveDeMiembro(idMiembros);

  if (!cache || !id) return;

  cache.set(id, Array.isArray(insignias) ? insignias : []);
}

export const imagenDelPerfilYaResuelta = (url) =>
  Boolean(url) && imagenesResueltas.has(String(url));

export function recordarImagenDelPerfil(url) {
  if (url) imagenesResueltas.add(String(url));
}
