// ----------------------------------------------------------------------
// SENDA DEL INSTRUCTOR (debajo de "Instructor CI" en la ficha del miembro).
//
// Los niveles por los que avanza un instructor. Hoy solo se asignan los dos
// primeros; Calificado y Especializado salen en la lista pero deshabilitados
// hasta que se defina cómo se otorgan. La API .NET no tiene el campo: vive en
// Firestore (`senda_instructor_miembros/{idMiembros}`).
// ----------------------------------------------------------------------

export const COLECCION_SENDA_INSTRUCTOR = 'senda_instructor_miembros';

export const NIVELES_SENDA_INSTRUCTOR = [
  { value: 'IF', label: 'Instructor en Formación (IF)' },
  { value: 'IC', label: 'Instructor Certificado (IC)' },
  { value: 'IQ', label: 'Instructor Calificado (IQ)', deshabilitado: true },
  { value: 'IE', label: 'Instructor Especializado (IE)', deshabilitado: true },
];

/**
 * Se marcan con casillas, así que es una lista de niveles. Solo quedan los
 * conocidos y en el orden de la senda; lo demás (ausente, basura) se ignora.
 */
export const normalizarSendaInstructor = (valor) => {
  const lista = Array.isArray(valor) ? valor : valor ? [valor] : [];
  return NIVELES_SENDA_INSTRUCTOR.map((n) => n.value).filter((v) => lista.includes(v));
};
