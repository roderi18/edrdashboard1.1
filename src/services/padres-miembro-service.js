import axios from 'src/lib/axios';

// ----------------------------------------------------------------------
// Padres o tutores de un miembro.
//
// Todo pasa por la ruta del servidor: aqui no se escribe a Firestore directo.
// El token lo pone el interceptor de axios, y la ruta comprueba la sesion y el
// permiso `padres.editar` antes de guardar nada.
// ----------------------------------------------------------------------

const RUTA = '/api/miembros/padres/';

export const PADRES_VACIO = {
  padre: { nombres: '', apellidos: '', telefono: '' },
  madre: { nombres: '', apellidos: '', telefono: '' },
  nota: '',
};

/** Lo que hay guardado, o la ficha vacia si todavia no hay nada. */
export async function obtenerPadresDelMiembro(idMiembro) {
  if (!idMiembro) return PADRES_VACIO;

  const { data } = await axios.get(RUTA, { params: { idMiembro } });

  return {
    ...PADRES_VACIO,
    ...(data?.padres ?? {}),
    padre: { ...PADRES_VACIO.padre, ...(data?.padres?.padre ?? {}) },
    madre: { ...PADRES_VACIO.madre, ...(data?.padres?.madre ?? {}) },
  };
}

/**
 * Guarda. Los errores se dejan subir: quien llama los enseña.
 *
 * Decir "guardado" cuando el servidor dijo que no seria mentir, y aqui lo que
 * se guarda son los telefonos a los que se llama cuando algo pasa.
 */
export async function guardarPadresDelMiembro({ idMiembro, padre, madre, nota }) {
  const { data } = await axios.put(RUTA, { idMiembro, padre, madre, nota });

  return data?.padres ?? null;
}
