// ----------------------------------------------------------------------
// TARJETA EDITABLE (Desarrollo · pantalla).
//
// Un recuadro como los de `/dashboard/course` que el Administrador Global puede
// rehacer desde la aplicación: foto, textos y tamaño del contenedor. Se guarda
// en `tarjetas_desarrollo/{id}`. Lo que llega de Firestore pasa por
// `sanearTarjeta`: un campo roto vuelve a su valor de fábrica en vez de dejar la
// tarjeta sin pintar o con un ancho imposible.
// ----------------------------------------------------------------------

export const COLECCION_TARJETAS_DESARROLLO = 'tarjetas_desarrollo';
export const ID_TARJETA_DEMO = 'demo';

// Límites del contenedor (px). Por debajo de 240 de ancho el pie se monta
// encima; por encima de 720 deja de parecer una tarjeta.
export const LIMITES_TARJETA = Object.freeze({
  ancho: { min: 240, max: 720 },
  altoImagen: { min: 120, max: 520 },
  radio: { min: 0, max: 32 },
  tamanoTitulo: { min: 12, max: 40 },
  tamanoSubtitulo: { min: 10, max: 32 },
});

// Los tipos de letra que la aplicación ya carga (`src/global.css`): uno que no
// estuviera cargado saldría en la letra del sistema, distinta en cada equipo.
export const FUENTES_TARJETA = Object.freeze([
  { id: 'tema', nombre: 'La del tema', css: '' },
  { id: 'public-sans', nombre: 'Public Sans', css: '"Public Sans Variable", sans-serif' },
  { id: 'barlow', nombre: 'Barlow', css: 'Barlow, sans-serif' },
  { id: 'inter', nombre: 'Inter', css: '"Inter Variable", sans-serif' },
  { id: 'dm-sans', nombre: 'DM Sans', css: '"DM Sans Variable", sans-serif' },
  { id: 'nunito-sans', nombre: 'Nunito Sans', css: '"Nunito Sans Variable", sans-serif' },
  // No se carga: Georgia y Times vienen en todos los sistemas. Es la letra de
  // las placas ("Mirke de León / 2008-2010").
  { id: 'serif', nombre: 'Clásica (serif)', css: 'Georgia, "Times New Roman", serif' },
]);

// Cada capa: dónde está su CENTRO dentro de la foto (x, y en %) y qué ancho
// ocupa (% del ancho de la foto). En % para que siga en su sitio al cambiar el
// tamaño del contenedor.
export const MAX_CAPAS = 10;
export const LIMITES_CAPA = Object.freeze({
  ancho: { min: 5, max: 100 },
  tamanoTexto: { min: 6, max: 48 },
});

// Texto encima de una capa: dos líneas centradas (nombre arriba, años abajo).
export const TEXTO_DE_CAPA = Object.freeze({
  // Con {nombre} y {año}, la galería pone los de cada director.
  textoArriba: '{nombre}',
  textoAbajo: '{año}',
  colorTexto: '#2B1B0A',
  tamanoTexto: 14,
  fuenteTexto: 'serif',
});

const enRango = (valor, min, max, porDefecto) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return porDefecto;
  return Math.min(max, Math.max(min, numero));
};

export function sanearCapas(capas) {
  if (!Array.isArray(capas)) return [];

  return capas
    .filter(
      (capa) => capa && typeof capa.url === 'string' && /^https:\/\//.test(capa.url) && capa.id
    )
    .slice(0, MAX_CAPAS)
    .map((capa) => ({
      id: String(capa.id).slice(0, 40),
      url: capa.url,
      x: Math.round(enRango(capa.x, 0, 100, 50) * 10) / 10,
      y: Math.round(enRango(capa.y, 0, 100, 50) * 10) / 10,
      ancho: Math.round(enRango(capa.ancho, LIMITES_CAPA.ancho.min, LIMITES_CAPA.ancho.max, 30)),
      textoArriba: typeof capa.textoArriba === 'string' ? capa.textoArriba.slice(0, 80) : '',
      textoAbajo: typeof capa.textoAbajo === 'string' ? capa.textoAbajo.slice(0, 80) : '',
      colorTexto:
        typeof capa.colorTexto === 'string' && /^#[0-9a-fA-F]{6}$/.test(capa.colorTexto)
          ? capa.colorTexto
          : TEXTO_DE_CAPA.colorTexto,
      tamanoTexto: Math.round(
        enRango(
          capa.tamanoTexto,
          LIMITES_CAPA.tamanoTexto.min,
          LIMITES_CAPA.tamanoTexto.max,
          TEXTO_DE_CAPA.tamanoTexto
        )
      ),
      fuenteTexto: FUENTES_TARJETA.some((f) => f.id === capa.fuenteTexto)
        ? capa.fuenteTexto
        : TEXTO_DE_CAPA.fuenteTexto,
    }));
}

export const cssDeFuente = (id) => FUENTES_TARJETA.find((f) => f.id === id)?.css || undefined;

export const TARJETA_DE_FABRICA = Object.freeze({
  imagenUrl: '',
  // La foto SIN recortar: volver a encuadrar parte de ella, no del recorte
  // anterior (si no, cada recorte perdía lo que el anterior dejó fuera).
  imagenOriginalUrl: '',
  titulo: 'Introducción a la programación en Python',
  subtitulo: 'Curso para principiantes',
  tamanoTitulo: 14,
  tamanoSubtitulo: 13,
  fuente: 'tema',
  // Imágenes flotantes encima de la foto (un sello, un logo, una insignia).
  capas: [],
  ancho: 340,
  altoImagen: 250,
  radio: 16,
});

const TEXTOS = ['titulo', 'subtitulo'];
const MAX_TEXTO = 200;

function limitar(valor, { min, max }, porDefecto) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return porDefecto;
  return Math.min(max, Math.max(min, Math.round(numero)));
}

export function sanearTarjeta(datos) {
  const fuente = datos && typeof datos === 'object' ? datos : {};
  const tarjeta = { ...TARJETA_DE_FABRICA };

  TEXTOS.forEach((campo) => {
    if (typeof fuente[campo] === 'string') tarjeta[campo] = fuente[campo].slice(0, MAX_TEXTO);
  });

  // Solo https: una URL de otro esquema (javascript:, data:) no se pinta.
  ['imagenUrl', 'imagenOriginalUrl'].forEach((campo) => {
    if (typeof fuente[campo] === 'string' && /^https:\/\//.test(fuente[campo])) {
      tarjeta[campo] = fuente[campo];
    }
  });

  tarjeta.ancho = limitar(fuente.ancho, LIMITES_TARJETA.ancho, TARJETA_DE_FABRICA.ancho);
  tarjeta.altoImagen = limitar(
    fuente.altoImagen,
    LIMITES_TARJETA.altoImagen,
    TARJETA_DE_FABRICA.altoImagen
  );
  tarjeta.radio = limitar(fuente.radio, LIMITES_TARJETA.radio, TARJETA_DE_FABRICA.radio);
  tarjeta.tamanoTitulo = limitar(
    fuente.tamanoTitulo,
    LIMITES_TARJETA.tamanoTitulo,
    TARJETA_DE_FABRICA.tamanoTitulo
  );
  tarjeta.tamanoSubtitulo = limitar(
    fuente.tamanoSubtitulo,
    LIMITES_TARJETA.tamanoSubtitulo,
    TARJETA_DE_FABRICA.tamanoSubtitulo
  );
  tarjeta.capas = sanearCapas(fuente.capas);
  if (FUENTES_TARJETA.some((f) => f.id === fuente.fuente)) tarjeta.fuente = fuente.fuente;

  return tarjeta;
}
