// La regla, sin Firebase, para poder probarla: los claims nuevos, y si los que ya
// tenía llevaban `debeCambiarClave: true`, con la marca intacta. Ver
// `claims-con-marca-de-clave.js`.
export const claimsConservandoClave = (actuales = {}, nuevos = {}) =>
  actuales?.debeCambiarClave === true ? { ...nuevos, debeCambiarClave: true } : { ...nuevos };
