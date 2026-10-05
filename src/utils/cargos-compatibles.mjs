// ----------------------------------------------------------------------
// CARGOS DE CONSEJO QUE PUEDEN IR JUNTOS.
//
// La regla general sigue: nadie sirve en dos consejos (nacional, regional,
// seccional) a la vez. Excepción: ser Oficial Especial de la Nacional convive
// con un cargo de región o de sección. Es un encargo nacional (Protocolo,
// Diseño y artes…) que suele recaer en quien ya dirige una sección o una región,
// como Stalin Peralta, Subdirector Regional. Antes la regla lo apagaba en
// "Asignar miembros" y, si se forzaba, darle uno le quitaba el otro.
//
// En la NACIONAL hay dos grupos: lo que cuelga del Consejo Ejecutivo (sus
// coordinadores, Sub-Director, comités…) y el resto del Consejo Nacional
// (Vicepresidente, Secretario y Tesorero Ejecutivo, Presidente, Capellán…). Una
// persona puede tener UN cargo de cada grupo a la vez —Juan Carlos García es
// Vicepresidente y también Coordinador Nacional de Adiestramiento—; dentro de un
// mismo grupo sigue valiendo un cargo por persona.
// ----------------------------------------------------------------------

import { DIRECTIVA_POSITIONS } from '../catalogs/directiva-positions.js';

const ES_OFICIAL_ESPECIAL = /^nacional-oficial-especial-(?:[1-9]|1\d|20)$/;
const NIVELES_QUE_CONVIVEN = ['regional', 'seccional'];

export const esOficialEspecial = (idPosicionDirectiva) =>
  ES_OFICIAL_ESPECIAL.test(String(idPosicionDirectiva ?? '').trim());

const posicionDe = (cargo) => cargo?.idPosicionDirectiva ?? cargo?.idCargo ?? '';

/**
 * `true` si los dos cargos pueden estar a la vez en la misma persona. Cada uno es
 * `{ nivel, idPosicionDirectiva }` (sirve una asignación o una posición del
 * catálogo).
 */
export function sonCargosCompatibles(a, b, posiciones = DIRECTIVA_POSITIONS) {
  const oficialConSupervision = (oficial, otro) =>
    esOficialEspecial(posicionDe(oficial)) && NIVELES_QUE_CONVIVEN.includes(otro?.nivel);

  return (
    oficialConSupervision(a, b) ||
    oficialConSupervision(b, a) ||
    deGruposNacionalesDistintos(a, b, posiciones)
  );
}

const NIVEL_NACIONAL = 'nacional';
const NODO_CONSEJO_EJECUTIVO = 'consejo-ejecutivo';

/**
 * ¿Cuelga este cargo nacional del Consejo Ejecutivo? Se sube por el árbol del
 * catálogo (también las casillas añadidas, que cuelgan por `idNodoPadre`) hasta
 * dar con el contenedor "Consejo Ejecutivo" o con la raíz.
 */
export function esDelConsejoEjecutivo(idPosicionDirectiva, posiciones = DIRECTIVA_POSITIONS) {
  const nacionales = posiciones.filter((p) => p?.nivel === NIVEL_NACIONAL);
  let actual = nacionales.find((p) => p.idCargo === String(idPosicionDirectiva ?? '').trim());

  // Tope de vueltas: un catálogo mal enlazado no puede colgar la pantalla.
  for (let vueltas = 0; actual && vueltas < 30; vueltas += 1) {
    const padre = actual.idNodoPadre;

    if (!padre) return false;
    if (padre === NODO_CONSEJO_EJECUTIVO) return true;
    actual = nacionales.find((p) => p.idNodoDiagrama === padre);
  }

  return false;
}

const deGruposNacionalesDistintos = (a, b, posiciones) =>
  a?.nivel === NIVEL_NACIONAL &&
  b?.nivel === NIVEL_NACIONAL &&
  Boolean(posicionDe(a)) &&
  Boolean(posicionDe(b)) &&
  esDelConsejoEjecutivo(posicionDe(a), posiciones) !==
    esDelConsejoEjecutivo(posicionDe(b), posiciones);
