import { ALCANCES } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// EN QUE MODULO SE ESTA MIRANDO.
//
// Una persona puede ejercer dos cargos a la vez —Coordinador de su destacamento
// y, ademas, algo en su seccion—. Los permisos se suman, pero cuando dos cargos
// dicen cosas distintas sobre lo MISMO hace falta saber cual manda, y eso
// depende de donde este parada:
//
//   Miembros y Destacamentos -> manda su cargo de DESTACAMENTO.
//   Secciones                -> manda su cargo de SECCION.
//   Regiones                 -> manda su cargo de REGION.
//   Consejo Nacional         -> manda su cargo NACIONAL.
//
// Sin esto ganaba siempre el de mayor nivel, y un Coordinador de Destacamento
// que ademas tuviera una casilla en su seccion —donde no se edita a nadie— se
// quedaba sin poder editar a los miembros de su propio destacamento.
//
// El Administrador Global, el Administrador Funcional y la Oficina Nacional
// quedan fuera de esta regla: mandan en todos los modulos.
//
// El modulo se guarda en el modulo (una variable suelta) y no en un contexto de
// React a proposito: quien lo pregunta son funciones puras —los guardas de
// acceso—, a las que no llega un hook. Lo escribe una sola vez el layout del
// panel al cambiar de ruta.
// ----------------------------------------------------------------------

export const MODULOS = {
  miembros: 'miembros',
  destacamentos: 'destacamentos',
  secciones: 'secciones',
  regiones: 'regiones',
  nacional: 'nacional',
};

// Que nivel de cargo manda en cada modulo.
export const ALCANCE_QUE_MANDA = {
  [MODULOS.miembros]: ALCANCES.DESTACAMENTO,
  [MODULOS.destacamentos]: ALCANCES.DESTACAMENTO,
  [MODULOS.secciones]: ALCANCES.SECCION,
  [MODULOS.regiones]: ALCANCES.REGION,
  [MODULOS.nacional]: ALCANCES.NACIONAL,
};

let moduloActivo = '';

export const setModuloActivo = (modulo) => {
  moduloActivo = MODULOS[modulo] ? modulo : '';
};

export const getModuloActivo = () => moduloActivo;

/** Fuera de estas rutas no hay modulo que mande: se decide como siempre. */
export const moduloDesdeRuta = (ruta = '') => {
  const camino = String(ruta || '').toLowerCase();

  if (camino.includes('/level/member')) return MODULOS.miembros;
  if (camino.includes('/level/dest')) return MODULOS.destacamentos;
  if (camino.includes('/level/sectional')) return MODULOS.secciones;
  if (camino.includes('/level/regional')) return MODULOS.regiones;
  if (camino.includes('/level/national')) return MODULOS.nacional;

  return '';
};

/** El alcance del cargo que manda aqui, o '' si el modulo no decide nada. */
export const alcanceQueMandaAhora = () => ALCANCE_QUE_MANDA[getModuloActivo()] || '';
