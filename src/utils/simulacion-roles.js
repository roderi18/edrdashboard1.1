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

/**
 * DONDE se ejerce la pareja de prueba.
 *
 * Un cargo no existe en el aire: es Coordinador DE un destacamento, de UNA
 * seccion. Sin una entidad concreta el alcance sale vacio y la prueba enseña
 * listas en blanco, que no se parecen a lo que ve la persona de verdad. Se fija
 * el destacamento Tribu de Judá 18, con su seccion y su region reales, que es
 * donde hay datos para mirar.
 */
export const ENTIDADES_DE_PRUEBA = {
  destacamento: { id: 231, nombre: 'Tribu de Judá 18' },
  seccion: { id: 1, nombre: 'Este Oriental I' },
  region: { id: 3, nombre: 'Región Central' },
};

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
