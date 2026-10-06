import { COLECCIONES } from '../config/esquema-firestore.mjs';

// ----------------------------------------------------------------------
// LA EVALUACIÓN DEL DESTACAMENTO.
//
// Tres datos del registro nacional: el número de evaluación, cuándo se evaluó y
// cuándo se entregó el reconocimiento. Los ven y los cambian SOLO el
// Administrador Global y la Oficina Nacional (`puedeVerEvaluacionDeDestacamento`
// en org-level-access.js): la pestaña "Evaluación" de la ficha no sale a nadie
// más. La API .NET no tiene dónde guardarlo, así que vive en Firestore
// (`evaluaciones_destacamentos/{idDestacamento}`), como el estado Activo/Inactivo.
// ----------------------------------------------------------------------

export const COLECCION_EVALUACIONES_DESTACAMENTOS = COLECCIONES.evaluacionesDestacamentos;

export const EVALUACION_VACIA = Object.freeze({
  numeroEvaluacion: '',
  fechaEvaluacion: '',
  fechaEntregaReconocimiento: '',
  // Texto libre: sobre todo los otros teléfonos del pastor, que en el padrón
  // solo cabe uno.
  nota: '',
});

// Las fechas se guardan como "AAAA-MM-DD": sin hora, no se corren de día por la
// zona horaria de quien las mira.
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fecha = (v) => (FECHA.test(String(v ?? '')) ? String(v) : '');

/** Lo guardado (o nada) con la forma del formulario; lo que no cuadra, vacío. */
export const normalizarEvaluacion = (datos = {}) => ({
  numeroEvaluacion: String(datos?.numeroEvaluacion ?? '')
    .trim()
    .slice(0, 30),
  fechaEvaluacion: fecha(datos?.fechaEvaluacion),
  fechaEntregaReconocimiento: fecha(datos?.fechaEntregaReconocimiento),
  nota: String(datos?.nota ?? '')
    .trim()
    .slice(0, 1000),
});

export const ETIQUETAS_EVALUACION = {
  numeroEvaluacion: 'No. de Evaluación',
  fechaEvaluacion: 'Fecha evaluación',
  fechaEntregaReconocimiento: 'Fecha de entrega reconocimiento',
  nota: 'Nota',
};

/** Los campos que cambian, para Historial: [{ campo, etiqueta, antes, despues }]. */
export const cambiosDeEvaluacion = (antes = {}, despues = {}) => {
  const a = normalizarEvaluacion(antes);
  const d = normalizarEvaluacion(despues);

  return Object.keys(ETIQUETAS_EVALUACION)
    .filter((campo) => a[campo] !== d[campo])
    .map((campo) => ({
      campo,
      etiqueta: ETIQUETAS_EVALUACION[campo],
      antes: a[campo] || null,
      despues: d[campo] || null,
    }));
};
