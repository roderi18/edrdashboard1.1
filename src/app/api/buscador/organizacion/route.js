import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { armarIndiceDeOrganizacion } from 'src/utils/buscador-organizacion.mjs';
import { UPSTREAM_KEYS, fetchUpstreamText, buildScopedUpstreamKey } from 'src/utils/upstream-cache';

// Por REST y no con el Admin SDK, como `/api/members`: comprobar que hay sesion
// no necesita privilegios, y el Admin SDK tumbaba rutas enteras en Netlify.
import { identificarConSesionRest } from 'src/server/sesion-rest.mjs';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// MIEMBROS, DESTACAMENTOS, SECCIONES Y REGIONES PARA EL BUSCADOR DE LA CABECERA.
//
// Solo con sesion, y solo lo que hace falta para encontrar a alguien: nombre,
// codigo y a que destacamento pertenece (`armarIndiceDeOrganizacion`). Ni
// telefonos, ni correos, ni fechas de nacimiento: el padron completo sigue
// saliendo unicamente por `/api/members`, acotado por alcance.
//
// Se arma una vez cada cinco minutos por servidor y se reparte a todos: es el
// mismo indice para cualquiera, y la API .NET tarda de 0,3 a 17 segundos.
// ----------------------------------------------------------------------

const API = 'https://systexploradores.somee.com/api';
const MIEMBROS_PAGINADOS = `${API}/Miembros/GetAllMiembrosPagination`;
const TAMANO_DE_PAGINA = 250;
const TIEMPO_MAXIMO_MS = process.env.NODE_ENV === 'development' ? 25_000 : 9_000;
const CACHE_MS = 5 * 60_000;

let guardado = null;

const filasDe = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const pedirLista = async (clave, url) => {
  const respuesta = await fetchUpstreamText(clave, url, { timeoutMs: TIEMPO_MAXIMO_MS }).catch(
    () => null
  );

  if (!respuesta?.ok || !respuesta.text) return [];

  return filasDe(normalizeApiResponse(JSON.parse(respuesta.text)));
};

const pedirPaginaDeMiembros = async ({ clave, pagina, autorizacion }) => {
  const respuesta = await fetchUpstreamText(`${clave}:pagina:${pagina}`, MIEMBROS_PAGINADOS, {
    timeoutMs: TIEMPO_MAXIMO_MS,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(autorizacion ? { Authorization: autorizacion } : {}),
      },
      body: JSON.stringify({ page: pagina, pageSize: TAMANO_DE_PAGINA }),
    },
  });

  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status} al pedir miembros.`);

  const payload = JSON.parse(respuesta.text);
  const datos = payload?.data ?? payload?.Data ?? payload;

  return {
    filas: filasDe(datos),
    paginas: Math.max(1, Number(datos?.totalPages ?? datos?.TotalPages ?? 1) || 1),
  };
};

const pedirMiembros = async (autorizacion) => {
  const clave = buildScopedUpstreamKey(UPSTREAM_KEYS.miembros, autorizacion);
  const primera = await pedirPaginaDeMiembros({ clave, pagina: 1, autorizacion });
  const resto = await Promise.all(
    Array.from({ length: primera.paginas - 1 }, (_, indice) =>
      pedirPaginaDeMiembros({ clave, pagina: indice + 2, autorizacion })
    )
  );

  return [primera, ...resto].flatMap((pagina) => pagina.filas);
};

const armarIndice = async (autorizacion) => {
  const [miembros, destacamentos, iglesias, secciones, regiones] = await Promise.all([
    pedirMiembros(autorizacion),
    pedirLista(UPSTREAM_KEYS.destacamentos, `${API}/Destacamentos/GetAllDestacamentos`),
    pedirLista(UPSTREAM_KEYS.iglesias, `${API}/Iglesias/GetAllIglesias`),
    pedirLista(UPSTREAM_KEYS.secciones, `${API}/Secciones/GetAllSecciones`),
    pedirLista(UPSTREAM_KEYS.regiones, `${API}/Regiones/GetAllRegiones`),
  ]);

  return armarIndiceDeOrganizacion({ miembros, destacamentos, iglesias, secciones, regiones });
};

const VACIO = { miembros: [], destacamentos: [], secciones: [], regiones: [] };

export async function GET(req) {
  const { error: sinSesion } = await identificarConSesionRest(req);

  if (sinSesion) return sinSesion;

  try {
    if (!guardado || guardado.hasta < Date.now()) {
      guardado = {
        hasta: Date.now() + CACHE_MS,
        datos: await armarIndice(req.headers.get('authorization') || ''),
      };
    }

    return Response.json(guardado.datos, {
      // Privado: son nombres de personas, no se guardan en una cache compartida.
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error) {
    // El resto del buscador sigue funcionando: se responde vacio en vez de romper
    // la cabecera entera.
    console.warn('[buscador/organizacion] no se pudo armar el índice', error?.message ?? error);

    return Response.json(VACIO, { status: 200 });
  }
}
