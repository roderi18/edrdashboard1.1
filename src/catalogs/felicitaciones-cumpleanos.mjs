// ----------------------------------------------------------------------
// LOS MENSAJES DE FELICITACION.
//
// Quien pulsa "Enviar mensaje de felicitaciones" no escribe nada: se manda uno
// de estos, al azar. La gracia es que dos personas que feliciten al mismo
// cumpleañero no le manden lo mismo, asi que la eleccion NO se repite hasta que
// la lista se agota; cuando se agota, vuelve a empezar.
//
// Cada mensaje lleva un id estable. Se usa para recordar cuales ya salieron, asi
// que un id NO se renombra ni se reutiliza: si un mensaje se retira, su id se
// jubila con el.
//
// `{nombre}` se sustituye por el del cumpleañero. Los que no lo llevan
// funcionan igual: son mensajes cortos porque llegan como mensaje, no como
// carta.
//
// Ninguno tiene genero —el mismo sirve para cualquiera— y ninguno hace bromas
// de edad: en un destacamento cumple años tanto un nino de nueve como un adulto.
//
// Cada uno cierra con UN emoji, y solo uno: es un mensaje de felicitacion, no
// una guirnalda. Los de la seccion de fe llevan los suyos aparte para que el
// tono no se mezcle.
// ----------------------------------------------------------------------

export const FELICITACIONES_CUMPLEANOS = [
  // --- Cercanos y de siempre ---
  { id: 'muchos-mas', texto: '¡Feliz cumpleaños, {nombre}! Que cumplas muchos más. 🎂' },
  { id: 'destacamento-celebra', texto: '¡Feliz cumpleaños! Hoy el destacamento entero celebra contigo. 🎉' },
  { id: 'abrazo-grande', texto: 'Un abrazo grande en tu día, {nombre}. ¡Feliz cumpleaños! 🤗' },
  { id: 'tu-dia', texto: '¡Hoy es tu día, {nombre}! Feliz cumpleaños, que lo disfrutes muchísimo. 🥳' },
  { id: 'celebramos-tu-vida', texto: 'Celebramos tu vida hoy. ¡Feliz cumpleaños! 🎈' },
  { id: 'parte-de-la-familia', texto: '¡Feliz cumpleaños! Gracias por ser parte de esta familia. ❤️' },
  { id: 'felicidades-de-todos', texto: '¡Felicidades, {nombre}! De parte de todo el destacamento. 🎉' },
  { id: 'se-nota-cuando-estas', texto: '¡Feliz cumpleaños, {nombre}! Se nota cuando estás. ✨' },
  { id: 'alegria-de-tenerte', texto: '¡Feliz cumpleaños! Da alegría tenerte en el destacamento. 😄' },
  { id: 'felicidades-en-tu-dia', texto: '¡Muchas felicidades en tu día, {nombre}! 🎊' },

  // --- Con la fe por delante ---
  { id: 'bendiciones', texto: '¡Feliz cumpleaños, {nombre}! Que este nuevo año de vida venga lleno de bendiciones. 🙏' },
  { id: 'dios-te-guarde', texto: '¡Feliz cumpleaños! Que Dios te siga guardando y guiando en el camino. 🙏' },
  { id: 'sabiduria-y-gracia', texto: 'Que sigas creciendo en sabiduría y en gracia. ¡Feliz cumpleaños, {nombre}! 🌱' },
  { id: 'gracias-por-tu-vida', texto: 'Hoy damos gracias por tu vida. ¡Feliz cumpleaños! 🙌' },
  { id: 'propositos-de-dios', texto: '¡Feliz cumpleaños, {nombre}! Que este año se cumplan los propósitos de Dios en ti. 🙏' },
  { id: 'larga-vida', texto: 'Que Dios te dé larga vida y días buenos. ¡Feliz cumpleaños! ✨' },
  { id: 'sigue-siendo-luz', texto: '¡Feliz cumpleaños! Sigue siendo luz donde quiera que vayas. 🕯️' },
  { id: 'tu-vida-es-un-regalo', texto: 'Tu vida es un regalo. ¡Feliz cumpleaños! 🎁' },

  // --- Más sueltos ---
  { id: 'salud-alegria-aventuras', texto: '¡Feliz cumpleaños! Que este año te traiga salud, alegría y muchas aventuras. 🏕️' },
  { id: 'toca-torta', texto: 'Hoy toca bizcochoooo. ¡Feliz cumpleaños, {nombre}! 🍰' },
  { id: 'pasala-lindo', texto: '¡Feliz cumpleaños! Que la pases lindo con los tuyos. 🎈' },
  { id: 'dia-tan-bueno', texto: 'Que este día sea tan bueno como tú, {nombre}. ¡Feliz cumpleaños! ☀️' },
  { id: 'un-ano-mas-de-camino', texto: 'Un año más de vida y de camino. ¡Feliz cumpleaños, {nombre}! 🥾' },
  { id: 'rodeado-de-los-tuyos', texto: '¡Feliz cumpleaños! Que lo celebres rodeado de los tuyos. 🎉' },
  { id: 'razones-para-sonreir', texto: 'Que hoy te sobren razones para sonreír. ¡Feliz cumpleaños, {nombre}! 😁' },
  { id: 'caminando-juntos', texto: 'Otro año más caminando juntos. ¡Feliz cumpleaños, {nombre}! 🤝' },
  { id: 'aventuras-nuevas', texto: '¡Feliz cumpleaños, {nombre}! Que este año traiga aventuras nuevas. 🧭' },
  { id: 'camino-por-delante', texto: '¡Feliz cumpleaños! Te queda mucho camino bueno por delante. 🌄' },
  { id: 'pastel-y-los-que-te-quieren', texto: 'Que no falte el pastel ni la gente que te quiere. ¡Feliz cumpleaños! 🍰' },
  { id: 'tu-mejor-ano', texto: 'Que este sea tu mejor año. ¡Feliz cumpleaños! 🌟' },
];

export const IDS_FELICITACIONES = FELICITACIONES_CUMPLEANOS.map(({ id }) => id);

/** El mensaje con el nombre puesto. Sin nombre, la frase se sostiene igual. */
export const redactarFelicitacion = (texto = '', nombre = '') => {
  const suyo = String(nombre ?? '').trim();

  if (!suyo) {
    // "¡Feliz cumpleaños, {nombre}!" -> "¡Feliz cumpleaños!": se quita tambien la
    // coma que quedaria colgando delante del hueco.
    return String(texto).replace(/,?\s*\{nombre\}/g, '');
  }

  return String(texto).replace(/\{nombre\}/g, suyo);
};

/**
 * Elige una felicitacion que no se haya usado todavia.
 *
 * `usados` son los ids que ya salieron. Cuando ya salieron todos, la lista se
 * da por agotada y vuelve a empezar de cero —si no, no habria nada que elegir—.
 * Devuelve tambien la lista de usados para que quien llama la guarde: la
 * eleccion es al azar, pero la MEMORIA de lo que ya salio es de quien la
 * persiste.
 */
export const elegirFelicitacion = ({ usados = [], azar = Math.random } = {}) => {
  const yaSalieron = new Set((Array.isArray(usados) ? usados : []).map(String));
  const disponibles = FELICITACIONES_CUMPLEANOS.filter(({ id }) => !yaSalieron.has(id));
  // La vuelta a empezar: se agoto la lista.
  const candidatos = disponibles.length ? disponibles : FELICITACIONES_CUMPLEANOS;
  const elegida = candidatos[Math.floor(azar() * candidatos.length)] ?? candidatos[0];

  return {
    ...elegida,
    usados: disponibles.length ? [...yaSalieron, elegida.id] : [elegida.id],
    vueltaAEmpezar: !disponibles.length,
  };
};
