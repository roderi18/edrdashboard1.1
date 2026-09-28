// ----------------------------------------------------------------------
// LAS CUATRO REGIONES Y SUS PROVINCIAS, con su color.
//
// Las mismas que el mapa de la landing de registro (errd-registro,
// `src/sections/registro/portada.jsx`): si una cambia, cambia la otra, o los dos
// mapas pintarían la misma provincia de colores distintos. Norte amarillo,
// Central azul, Sur rojo y Este verde; `color` es la clave de la paleta del tema.
// ----------------------------------------------------------------------

export const REGIONES_RD = [
  {
    nombre: 'Región Norte',
    color: 'warning',
    provincias: [
      'Monte Cristi',
      'Dajabón',
      'Santiago Rodríguez',
      'Valverde',
      'Santiago',
      'Puerto Plata',
      'Espaillat',
      'La Vega',
      'Duarte',
      'Hermanas Mirabal',
      'María Trinidad Sánchez',
      'Samaná',
      'Sánchez Ramírez',
    ],
  },
  {
    nombre: 'Región Central',
    color: 'primary',
    provincias: ['Distrito Nacional', 'Santo Domingo', 'Monte Plata', 'Monseñor Nouel'],
  },
  {
    nombre: 'Región Sur',
    color: 'error',
    provincias: [
      'Azua',
      'Bahoruco',
      'Barahona',
      'Elías Piña',
      'Independencia',
      'Pedernales',
      'Peravia',
      'San Cristóbal',
      'San Juan',
      'San José de Ocoa',
    ],
  },
  {
    nombre: 'Región Este',
    color: 'success',
    provincias: ['El Seibo', 'Hato Mayor', 'La Altagracia', 'La Romana', 'San Pedro de Macorís'],
  },
];

const sinTildes = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

// El catálogo escribe "Baoruco"; el mapa, "Bahoruco".
const ALIAS = { baoruco: 'bahoruco' };
const clave = (v) => ALIAS[sinTildes(v)] ?? sinTildes(v);

/** La región de una provincia (sin importar tildes ni mayúsculas), o null. */
export const regionDeProvincia = (provincia) =>
  REGIONES_RD.find((r) => r.provincias.some((p) => clave(p) === clave(provincia))) ?? null;
