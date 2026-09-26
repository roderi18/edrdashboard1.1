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
// No es excepción con otro cargo NACIONAL: dentro del Consejo Ejecutivo sigue
// valiendo un cargo por persona.
// ----------------------------------------------------------------------

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
export function sonCargosCompatibles(a, b) {
  const oficialConSupervision = (oficial, otro) =>
    esOficialEspecial(posicionDe(oficial)) && NIVELES_QUE_CONVIVEN.includes(otro?.nivel);

  return oficialConSupervision(a, b) || oficialConSupervision(b, a);
}
