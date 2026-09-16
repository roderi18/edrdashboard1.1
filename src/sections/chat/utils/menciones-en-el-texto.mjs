// ----------------------------------------------------------------------
// DONDE ESTAN LAS MENCIONES DE UN TEXTO.
//
// Una mencion es "@" seguido del nombre de alguien de la conversacion, tal cual
// lo puso el que escribe. No hay marca en el texto —se guarda como se escribio—,
// asi que reconocerla es comparar contra los nombres que hay delante.
//
// Vive aparte porque lo necesitan DOS sitios que tienen que enseñarla igual: el
// mensaje ya enviado y la caja donde se esta escribiendo. Cuando cada uno tenia
// su regla, la mencion se pintaba de un color al escribirla y de otro al
// enviarla, como si fueran dos cosas distintas.
// ----------------------------------------------------------------------

const escaparParaRegExp = (valor) => String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "@todos" avisa a toda la conversacion: es una mencion mas, sin ser nadie. */
export const MENCION_A_TODOS = 'todos';

/**
 * Los nombres que cuentan como mencion en una conversacion: los de la gente que
 * hay dentro, y "todos".
 *
 * Sale de aqui para que el mensaje enviado y la caja de escribir reconozcan
 * exactamente lo mismo; con cada uno haciendose su lista, "@todos" acababa
 * coloreado en un sitio y en gris en el otro.
 */
export const nombresMencionables = (participantes = []) => [
  MENCION_A_TODOS,
  ...participantes.map((participante) => participante?.name).filter(Boolean),
];

/**
 * Parte un texto en trozos, marcando cuales son menciones.
 *
 * Devuelve siempre al menos un trozo —el texto entero sin marcar— para que
 * quien lo pinta no tenga que distinguir "sin menciones" como un caso aparte.
 * Los nombres largos van primero: con "Ana" y "Ana María" delante, buscar por
 * orden de aparicion dejaba "@Ana María" partido en "@Ana" y " María".
 */
export function partirPorMenciones(texto = '', nombres = []) {
  const cadena = String(texto ?? '');
  const candidatos = [...new Set(nombres.filter(Boolean).map(String))].sort(
    (uno, otro) => otro.length - uno.length
  );

  if (!candidatos.length || !cadena.includes('@')) {
    return [{ texto: cadena, esMencion: false }];
  }

  const expresion = new RegExp(`(@(?:${candidatos.map(escaparParaRegExp).join('|')}))`, 'g');

  return cadena
    .split(expresion)
    .filter((trozo) => trozo !== '')
    .map((trozo) => ({
      texto: trozo,
      esMencion: candidatos.some((nombre) => trozo === `@${nombre}`),
    }));
}

/** Si el texto lleva alguna mencion de esa gente. */
export const tieneMenciones = (texto, nombres) =>
  partirPorMenciones(texto, nombres).some((trozo) => trozo.esMencion);
