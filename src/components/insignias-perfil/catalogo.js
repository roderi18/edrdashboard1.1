const RUTA_CINTAS = '/parches/Cintas%20y%20medallas/cintas-perfil';

const cinta = (id, nombre) => ({
  id,
  nombre,
  src: `${RUTA_CINTAS}/${id}.webp`,
});

// Catálogo único de insignias disponibles. Para añadir otra cinta basta con
// guardar su WebP en la carpeta pública y registrarla aquí con el mismo nombre.
export const INSIGNIAS_PERFIL = Object.freeze({
  'cinta-azul-brillante': cinta('cinta-azul-brillante', 'Cinta azul brillante'),
  'cinta-azul': cinta('cinta-azul', 'Cinta azul'),
  'cinta-gris': cinta('cinta-gris', 'Cinta gris'),
  'cinta-marron-oscura': cinta('cinta-marron-oscura', 'Cinta marrón oscura'),
  'cinta-naranja': cinta('cinta-naranja', 'Cinta naranja'),
  'cinta-roja-blanca-rayas': cinta('cinta-roja-blanca-rayas', 'Cinta roja y blanca a rayas'),
  'cinta-roja-gris': cinta('cinta-roja-gris', 'Cinta roja y gris'),
  'cinta-roja': cinta('cinta-roja', 'Cinta roja'),
  'cinta-rojo-anaranjada': cinta('cinta-rojo-anaranjada', 'Cinta rojo anaranjada'),
  'cinta-verde-blanca': cinta('cinta-verde-blanca', 'Cinta verde y blanca'),
  'cinta-verde': cinta('cinta-verde', 'Cinta verde'),
});

export const INSIGNIAS_PERFIL_DISPONIBLES = Object.freeze(Object.values(INSIGNIAS_PERFIL));

export const obtenerInsigniaPerfil = (id) => INSIGNIAS_PERFIL[String(id ?? '').trim()] ?? null;

export const obtenerNumeroDorado = (numero) => {
  const valor = Number(numero);

  if (!Number.isInteger(valor) || valor < 0 || valor > 9) return null;

  return `${RUTA_CINTAS}/numero-${valor}-dorado.webp`;
};
