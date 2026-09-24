import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';

import { AUTH } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// Los tutores de un miembro.
//
// Se llama con `fetch` contra nuestro propio origen, NO con la instancia de
// axios: esa lleva `baseURL` apuntando al servidor de la plantilla
// (`NEXT_PUBLIC_SERVER_URL`) y una ruta relativa acabaria en un dominio ajeno,
// frenada por CORS. Es el fallo que ya nos costo un "Network Error".
// ----------------------------------------------------------------------

const RUTA = '/api/miembros/tutores/';
const RUTA_NOTA = '/api/miembros/tutores/nota/';

const cabeceras = async () => {
  const cuenta = AUTH?.currentUser;

  if (!cuenta) throw new Error('Tu sesión expiró. Vuelve a entrar.');

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await cuenta.getIdToken()}`,
  };
};

/** Lo que diga el servidor cuando algo va mal, y no un error generico. */
const leerRespuesta = async (respuesta) => {
  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new Error(datos?.error || 'No se pudo completar la operación.');
  }

  return datos;
};

async function obtenerTutoresDelMiembroSinCache(idMiembro) {
  if (!idMiembro) return [];

  const respuesta = await fetch(`${RUTA}?idMiembro=${encodeURIComponent(idMiembro)}`, {
    headers: await cabeceras(),
  });
  const datos = await leerRespuesta(respuesta);

  return Array.isArray(datos?.tutores) ? datos.tutores : [];
}

/**
 * Guarda la lista ENTERA y devuelve la que quedo.
 *
 * Los errores se dejan subir: quien llama los enseña. Estos son los telefonos a
 * los que se llama cuando a un menor le pasa algo; dar por guardado lo que el
 * servidor rechazo seria la peor mentira posible aqui.
 */
async function guardarTutoresDelMiembroDirecto({ idMiembro, tutores }) {
  const respuesta = await fetch(RUTA, {
    method: 'PUT',
    headers: await cabeceras(),
    body: JSON.stringify({ idMiembro, tutores }),
  });
  const datos = await leerRespuesta(respuesta);

  return Array.isArray(datos?.tutores) ? datos.tutores : [];
}

async function obtenerNotaTutoresDelMiembroSinCache(idMiembro) {
  if (!idMiembro) return '';

  const respuesta = await fetch(`${RUTA_NOTA}?idMiembro=${encodeURIComponent(idMiembro)}`, {
    headers: await cabeceras(),
  });
  const datos = await leerRespuesta(respuesta);

  return String(datos?.nota ?? '');
}

async function guardarNotaTutoresDelMiembroDirecto({ idMiembro, nota, keepalive = false }) {
  const respuesta = await fetch(RUTA_NOTA, {
    method: 'PUT',
    headers: await cabeceras(),
    body: JSON.stringify({ idMiembro, nota }),
    keepalive,
  });
  const datos = await leerRespuesta(respuesta);

  return String(datos?.nota ?? '');
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const obtenerTutoresDelMiembro = conCache('tutores:obtenerTutoresDelMiembro', obtenerTutoresDelMiembroSinCache);
export const obtenerNotaTutoresDelMiembro = conCache('tutores:obtenerNotaTutoresDelMiembro', obtenerNotaTutoresDelMiembroSinCache);
export const guardarTutoresDelMiembro = conInvalidacion(guardarTutoresDelMiembroDirecto, [], ['tutores:']);
export const guardarNotaTutoresDelMiembro = conInvalidacion(guardarNotaTutoresDelMiembroDirecto, [], ['tutores:']);
