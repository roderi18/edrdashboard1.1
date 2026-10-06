/**
 * Alias seguros de campos. No se traducen automaticamente campos ambiguos
 * como `status`, `type` o `name`: deben resolverse por modulo para no cambiar
 * su significado.
 */
export const ALIAS_CAMPOS_FIRESTORE = Object.freeze({
  idMiembros: 'idMiembro',
  memberId: 'idMiembro',
  userId: 'idUsuario',
  createdAt: 'fechaCreacion',
  created_at: 'fechaCreacion',
  creadoEn: 'fechaCreacion',
  updatedAt: 'fechaActualizacion',
  updated_at: 'fechaActualizacion',
  actualizadoEn: 'fechaActualizacion',
  deletedAt: 'fechaEliminacion',
  deleted_at: 'fechaEliminacion',
  startDate: 'fechaInicio',
  start_date: 'fechaInicio',
  endDate: 'fechaFin',
  end_date: 'fechaFin',
});

export const nombreCampoCanonico = (campo) => ALIAS_CAMPOS_FIRESTORE[campo] || campo;

export const normalizarCamposFirestore = (valor, conflictos = [], ruta = '') => {
  if (Array.isArray(valor)) {
    return valor.map((elemento, indice) =>
      normalizarCamposFirestore(elemento, conflictos, `${ruta}[${indice}]`)
    );
  }

  if (
    !valor ||
    typeof valor !== 'object' ||
    typeof valor.toDate === 'function' ||
    valor.constructor?.name !== 'Object'
  ) {
    return valor;
  }

  return Object.entries(valor).reduce((resultado, [campo, contenido]) => {
    const campoCanonico = nombreCampoCanonico(campo);
    const rutaCampo = ruta ? `${ruta}.${campoCanonico}` : campoCanonico;

    if (campoCanonico in resultado && campoCanonico !== campo) {
      conflictos.push({ ruta: rutaCampo, heredado: campo, canonico: campoCanonico });
      return resultado;
    }

    resultado[campoCanonico] = normalizarCamposFirestore(contenido, conflictos, rutaCampo);
    return resultado;
  }, {});
};

export const leerCampoCompatible = (documento, campoCanonico, ...alias) => {
  if (!documento || typeof documento !== 'object') return undefined;
  if (documento[campoCanonico] !== undefined) return documento[campoCanonico];
  return alias.map((campo) => documento[campo]).find((valor) => valor !== undefined);
};

