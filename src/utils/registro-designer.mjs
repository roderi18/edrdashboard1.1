// ----------------------------------------------------------------------
// EL REGISTRO DE EXPLORA DESIGNER (pestaña "Registro", solo el Administrador
// Global): qué se guardó, editó o eliminó, cuándo y quién, en todas las pestañas.
//
// No es otra colección: todo lo del Designer pasa por `proponerCambio` con el
// ámbito `everest_designer`, que lo deja en Historial (`auditoria_sistema`, con
// `modulo: 'everest_designer'`). Así cualquier cosa nueva que se escriba desde
// el Designer por esa puerta sale aquí sola. Esta pieza solo lo clasifica para
// pintarlo: la pestaña de cada registro y si fue guardar, editar o eliminar.
//
// Sin React ni Firebase, para probarlo con `node --test`.
// ----------------------------------------------------------------------

export const MODULO_DESIGNER = 'everest_designer';

export const PESTANAS_DEL_REGISTRO = Object.freeze({
  portada: 'Portada',
  cintas: 'Cintas',
  medallas: 'Medallas',
  pines: 'Pines',
  paleta: 'Paleta',
  tarjeta: 'Tarjeta',
  accesos: 'Accesos',
  galeria: 'Galería de Directores',
  otro: 'Designer',
});

const POR_TIPO_DE_ENTIDAD = {
  insignia_cinta: 'cintas',
  insignia_medalla: 'medallas',
  insignia_pin: 'pines',
  accesos_designer: 'accesos',
  galeria_director_nacional: 'galeria',
  tarjeta_editable: 'tarjeta',
};

const POR_ORDEN = { orden: 'cintas', 'orden-medallas': 'medallas', 'orden-pines': 'pines' };

/** La pestaña del Designer de un registro de Historial. */
export const pestanaDelRegistro = (registro = {}) => {
  const entidad = registro?.entidad || {};
  const tipo = String(entidad.tipo || '');
  const ruta = String(entidad.ruta || '');

  if (POR_TIPO_DE_ENTIDAD[tipo]) return POR_TIPO_DE_ENTIDAD[tipo];
  if (tipo === 'configuracion_cintas') return POR_ORDEN[entidad.id] || 'cintas';

  const seccion = /[?&]seccion=([a-z]+)/.exec(ruta)?.[1];

  if (seccion && PESTANAS_DEL_REGISTRO[seccion]) return seccion;
  if (/[?&]bloque=/.test(ruta) || /portada|bloque|campana|everest/i.test(tipo)) return 'portada';

  return 'otro';
};

/** "Guardó", "Editó" o "Eliminó", según lo que diga el registro. */
export const accionDelRegistro = (registro = {}) => {
  const texto = `${registro?.descripcion || ''} ${registro?.accion || ''}`.toLowerCase();
  const despues = registro?.despues || {};

  if (/elimin|quit|retir|borr/.test(texto) || despues.eliminada === true) return 'eliminar';
  if (/edit|cambi|actualiz|nuevo orden|renombr/.test(texto)) return 'editar';

  return 'guardar';
};

export const NOMBRE_DE_ACCION_DEL_REGISTRO = Object.freeze({
  guardar: 'Guardó',
  editar: 'Editó',
  eliminar: 'Eliminó',
});

/** Quién lo hizo, con lo que haya en el registro. */
export const personaDelRegistro = (registro = {}) => {
  const quien = registro?.realizadoPor || {};

  return quien.nombre || quien.correo || quien.codigoMiembro || 'Sin identificar';
};

/** Los cambios campo a campo, para el detalle: [{ campo, antes, despues }]. */
export const cambiosDelRegistro = (registro = {}) => {
  const antes = registro?.antes || {};
  const despues = registro?.despues || {};

  return [...new Set([...Object.keys(antes), ...Object.keys(despues)])].map((campo) => ({
    campo,
    antes: antes[campo] ?? null,
    despues: despues[campo] ?? null,
  }));
};
