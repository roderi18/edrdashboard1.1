import {
  ACCESOS_RAPIDOS,
  EVENTOS_DE_EJEMPLO,
  RESUMEN_DE_EJEMPLO,
  HISTORIAS_DE_EJEMPLO,
  COMUNICADOS_DE_EJEMPLO,
  MI_PROGRESO_DE_EJEMPLO,
  PROXIMA_ACTIVIDAD_DE_EJEMPLO,
  DESTACAMENTO_DESTACADO_DE_EJEMPLO,
} from './datos-de-ejemplo';

// ----------------------------------------------------------------------
// EL VALOR DE FABRICA DE CADA BLOQUE DE LA PORTADA.
//
// Lo que se pinta en cada bloque mientras nadie lo publique desde EXPLORA
// Designer: exactamente lo de hoy. Aqui no se inventa ni se copia nada —cada
// entrada apunta al mismo dato que ya usaba la pantalla—, para que "sin publicar"
// y "como siempre" sean, literalmente, la misma cosa.
//
// Las claves son los `id` de `src/utils/everest/bloques.mjs`. Lo lee la portada
// a traves de `useContenidoDePortada`.
// ----------------------------------------------------------------------

/**
 * El cierre de la columna lateral. Estaba escrito dentro de `PrincipalLema`, con
 * un `<br />` en medio del titulo; aqui el salto es un `\n`, y el componente lo
 * vuelve a pintar como `<br />`, asi que se ve igual que antes.
 *
 * No va en `datos-de-ejemplo.js` porque no es un dato inventado: es el lema.
 */
export const LEMA_DE_FABRICA = Object.freeze({
  titulo: 'Más que una organización,\nuna familia.',
  pie: 'Servir · Liderar · Transformar',
});

export const FABRICA_DE_PORTADA = Object.freeze({
  bienvenida: RESUMEN_DE_EJEMPLO,
  'accesos-rapidos': ACCESOS_RAPIDOS,
  'proxima-actividad': PROXIMA_ACTIVIDAD_DE_EJEMPLO,
  'mi-progreso': MI_PROGRESO_DE_EJEMPLO,
  historias: HISTORIAS_DE_EJEMPLO,
  'proximos-eventos': EVENTOS_DE_EJEMPLO,
  'destacamento-destacado': DESTACAMENTO_DESTACADO_DE_EJEMPLO,
  comunicados: COMUNICADOS_DE_EJEMPLO,
  lema: LEMA_DE_FABRICA,
});
