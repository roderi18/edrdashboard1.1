// ----------------------------------------------------------------------
// AQUI SE CAMBIA EL TIEMPO DE LAS ESPERAS DE CORTESIA.
//
// No son tiempo de trabajo: son el acuse de recibo de una accion. Guardar o
// asignar puede resolverse en decenas de milisegundos, tan rapido que el clic se
// queda sin respuesta visible y no da la sensacion de haber hecho nada. Esta
// espera sostiene el indicador de carga el tiempo suficiente para que se lea.
//
// Se aplica como MINIMO, no como suma: la espera corre EN PARALELO con el
// guardado real (ver `conEsperaMinima`). Un guardado rapido no se salta el
// acuse, y uno lento no arrastra estos milisegundos encima.
// ----------------------------------------------------------------------

export const RETARDO_GUARDADO_MS = 600;

export const esperar = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Ejecuta `promesa` garantizando que no se resuelva antes de `ms`.
 *
 * Si la promesa REVIENTA, el error sale de inmediato sin esperar: un fallo debe
 * verse cuanto antes, la cortesia es solo para el camino feliz.
 */
export const conEsperaMinima = async (promesa, ms = RETARDO_GUARDADO_MS) => {
  const [resultado] = await Promise.all([promesa, esperar(ms)]);

  return resultado;
};
