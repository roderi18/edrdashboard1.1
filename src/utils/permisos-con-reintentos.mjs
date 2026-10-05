// Reintentos para completar los permisos de la sesion.
//
// Una lectura de cargos que se pasaba de tiempo devolvia `null`, igual que "no
// tiene cargos", y la sesion se quedaba sin las opciones de administrador (y asi
// se guardaba en la cache) hasta recargar. Aqui vive lo que lo evita: distinguir
// "no respondio" de "no tiene", y repetir hasta que responda.

// "No respondio". Distinto de `null`, que significa "respondio: no hay nada".
export const SIN_RESPUESTA = Symbol('sin-respuesta');

// Esperas entre intentos (ms). Tras el ultimo, se avisa en vez de callar.
export const ESPERAS_DE_REINTENTO_MS = [1500, 4000, 9000];

const esperaReal = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Repite `tarea` mientras falle y devuelve su resultado, o relanza el ultimo
 * error. Si `sigueVigente()` dice que ya no hace falta (entro otra cuenta o se
 * cerro la sesion), se detiene sin error y devuelve `undefined`.
 *
 * `esperasMs` y `esperar` se pueden sustituir para probarlo sin esperar de verdad.
 */
export async function conReintentos(
  tarea,
  { sigueVigente = () => true, esperasMs = ESPERAS_DE_REINTENTO_MS, esperar = esperaReal } = {}
) {
  let ultimoError;

  for (let intento = 0; intento <= esperasMs.length; intento += 1) {
    if (!sigueVigente()) return undefined;

    try {
      // Secuencial a proposito: cada intento depende de que el anterior fallara.
      return await tarea(intento);
    } catch (error) {
      ultimoError = error;

      if (intento < esperasMs.length) {
        await esperar(esperasMs[intento]);
      }
    }
  }

  throw ultimoError;
}
