// ----------------------------------------------------------------------
// PROBAR UNA PAREJA DE CARGOS, SIN TOCAR LA CUENTA.
//
// El Administrador Global necesita ver la aplicacion como la ve quien ejerce dos
// cargos a la vez. Eso NO se guarda en su asignacion de rol: cambiarla lo dejaria
// sin ser Administrador Global en la base de datos y, si las reglas no dejan
// escribir ese documento a un coordinador, se quedaria encerrado en el rol de
// prueba sin poder volver.
//
// Vive en `sessionStorage`: dura lo que la pestaña, no viaja a Firestore, no
// afecta a nadie mas y se apaga cerrandola. Las reglas del servidor siguen
// viendo al Administrador Global de verdad, que es lo que corresponde: esto
// prueba la INTERFAZ, no suplanta a nadie.
// ----------------------------------------------------------------------

const CLAVE = 'simulacion-roles';

const sinVentana = () => typeof window === 'undefined' || !window.sessionStorage;

export const leerSimulacionDeRoles = () => {
  if (sinVentana()) return null;

  try {
    const crudo = window.sessionStorage.getItem(CLAVE);
    const datos = crudo ? JSON.parse(crudo) : null;

    return datos?.activa && datos?.rolDestacamento && datos?.rolAcompanante ? datos : null;
  } catch {
    return null;
  }
};

export const guardarSimulacionDeRoles = ({ rolDestacamento, rolAcompanante }) => {
  if (sinVentana()) return;

  window.sessionStorage.setItem(
    CLAVE,
    JSON.stringify({ activa: true, rolDestacamento, rolAcompanante })
  );
};

export const borrarSimulacionDeRoles = () => {
  if (sinVentana()) return;

  window.sessionStorage.removeItem(CLAVE);
};
