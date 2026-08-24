// La decision pura de "¿puede este cargo tocarle el acceso a ese otro?".
//
// Vive aparte —y sin tocar Firestore— para poder probarla: es la regla que
// separa "el Coordinador ayuda a su Lider de Grupo" de "un Lider de Grupo entra
// en la cuenta del Director Nacional", y equivocarse aqui no se ve hasta que
// alguien lo aprovecha.

export const PESO_POR_NIVEL = { nacional: 4, regional: 3, seccional: 2, destacamento: 1 };

export const textoId = (valor) => {
  const limpio = String(valor ?? '').trim();

  return limpio && limpio !== '0' ? limpio : '';
};

/**
 * Cuanto manda, en dos numeros.
 *
 * El nivel no basta: el Coordinador de un destacamento y el Lider de Grupo del
 * mismo destacamento son los dos "nivel destacamento", y comparando solo por ahi
 * el Coordinador no podria ayudar a su propio Lider. Dentro de un nivel manda
 * mas el que esta mas arriba en el organigrama, que es el `orden` menor.
 *
 * Los cargos vienen ya ordenados de mayor a menor, asi que el primero cuenta.
 */
export const rangoDe = (cargos = []) => {
  const [principal] = Array.isArray(cargos) ? cargos : [];

  return {
    peso: PESO_POR_NIVEL[principal?.nivel] ?? principal?.peso ?? 0,
    orden: Number(principal?.orden ?? 999),
  };
};

export const mandaMasQue = (uno, otro) =>
  uno.peso > otro.peso || (uno.peso === otro.peso && uno.orden < otro.orden);

export const entidadesPorNivel = (cargos = [], nivel) =>
  (Array.isArray(cargos) ? cargos : [])
    .filter((cargo) => cargo?.nivel === nivel)
    .map((cargo) => textoId(cargo.idEntidad))
    .filter(Boolean);

/** ¿Cae ese destacamento dentro de alguna de sus casillas? */
export const alcanzaLaUbicacion = (cargos = [], ubicacion = {}) => {
  // Nacional: todo el pais, que es literalmente su casilla.
  if ((Array.isArray(cargos) ? cargos : []).some((cargo) => cargo?.nivel === 'nacional')) {
    return true;
  }

  const region = textoId(ubicacion.idRegion);
  const seccion = textoId(ubicacion.idSeccion);
  const destacamento = textoId(ubicacion.idDestacamento);

  return Boolean(
    (region && entidadesPorNivel(cargos, 'regional').includes(region)) ||
      (seccion && entidadesPorNivel(cargos, 'seccional').includes(seccion)) ||
      (destacamento && entidadesPorNivel(cargos, 'destacamento').includes(destacamento))
  );
};

/**
 * Las dos comprobaciones juntas, ya sin nada que consultar.
 *
 * Devuelve `{ permitido, motivo }`. El motivo es para el registro del servidor,
 * NO para la respuesta: distinguir "no es de los tuyos" de "manda mas que tu" es
 * dibujarle el organigrama a quien esta tanteando.
 */
export const decidirGestionDeMiembro = ({
  cargosSolicitante = [],
  cargosObjetivo = [],
  ubicacionObjetivo = null,
} = {}) => {
  if (!mandaMasQue(rangoDe(cargosSolicitante), rangoDe(cargosObjetivo))) {
    return { permitido: false, motivo: 'objetivo_de_igual_o_mayor_nivel' };
  }

  if (!ubicacionObjetivo) return { permitido: false, motivo: 'objetivo_sin_ficha' };

  return alcanzaLaUbicacion(cargosSolicitante, ubicacionObjetivo)
    ? { permitido: true, motivo: '' }
    : { permitido: false, motivo: 'fuera_de_alcance' };
};
