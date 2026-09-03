import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import {
  UPSTREAM_KEYS,
  fetchUpstreamText,
  invalidateUpstream,
  buildScopedUpstreamKey,
} from 'src/utils/upstream-cache';

import { getDivisions } from 'src/services/division-service';
// Por REST y no con el Admin SDK a proposito: importar `firebase-admin` en esta
// ruta la tumbaba entera en Netlify (500 al cargar el modulo, antes del
// handler), y con ella la lista de miembros. Comprobar que hay sesion no
// necesita privilegios.
import {
  miembrosDelAlcance,
  nivelDeAlcanceDeMiembros,
} from 'src/server/alcance-miembros-core.mjs';
import {
  identificarConSesionRest,
  exigirAdministradorGlobalRest,
} from 'src/server/sesion-rest.mjs';

const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const MEMBERS_PAGINATED_URL =
  'https://systexploradores.somee.com/api/Miembros/GetAllMiembrosPagination';
const MEMBERS_PAGE_SIZE = 250;
// En localhost no existe el corte de 10 s de Netlify. Dar margen al primer
// arranque de Somee evita un 500 espurio al reanudar el equipo o iniciar dev.
const MEMBERS_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 25_000 : 9_000;

const getDivisionIdByBirthdate = (birthDate, divisions) => {
  if (!birthDate) return null;

  const today = new Date();
  const [year, month, day] = String(birthDate).split('T')[0].split('-');
  const birth = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  const findByName = (keyword) =>
    divisions.find((division) =>
      String(division.name || '')
        .toLowerCase()
        .trim()
        .includes(keyword.toLowerCase())
    )?.id;

  if (age >= 5 && age <= 7) return findByName('navegantes');
  if (age >= 8 && age <= 10) return findByName('pioneros');
  if (age >= 11 && age <= 13) return findByName('seguidores');
  if (age >= 14 && age <= 17) return findByName('exploradores');
  if (age >= 18) return findByName('liderazgo');

  return null;
};

const getRowsFromNormalizedResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const leerPaginaDeMiembros = async ({ cacheKey, page, authHeader }) => {
  const upstream = await fetchUpstreamText(`${cacheKey}:pagina:${page}`, MEMBERS_PAGINATED_URL, {
    timeoutMs: MEMBERS_TIMEOUT_MS,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ page, pageSize: MEMBERS_PAGE_SIZE }),
    },
  });

  if (!upstream.ok) {
    throw new Error(`El servidor de datos respondió ${upstream.status} al obtener miembros.`);
  }

  const payload = JSON.parse(upstream.text);
  const pagina = payload?.data ?? payload?.Data ?? payload;

  return {
    items: getRowsFromNormalizedResponse(pagina),
    totalPages: Math.max(1, Number(pagina?.totalPages ?? pagina?.TotalPages ?? 1) || 1),
  };
};

// Las fichas antes descargaban GetAllMiembros. Ese endpoint puede tardar mas de
// 9 segundos y deja inutilizable hasta la consulta de UN solo miembro. La API
// ofrece la misma información paginada y responde mucho antes. Se trae la
// primera página para conocer el total y, si hiciera falta, las restantes en
// paralelo. Cada página conserva caché y alcance propios por usuario.
const leerPadronPaginado = async ({ cacheKey, authHeader }) => {
  const primera = await leerPaginaDeMiembros({ cacheKey, page: 1, authHeader });

  if (primera.totalPages === 1) return primera.items;

  const restantes = await Promise.all(
    Array.from({ length: primera.totalPages - 1 }, (_, index) =>
      leerPaginaDeMiembros({ cacheKey, page: index + 2, authHeader })
    )
  );

  return [primera, ...restantes].flatMap((pagina) => pagina.items);
};

const withCalculatedDivision = (member, divisions) => {
  if (isPositiveNumber(member?.idDivision)) return member;

  const idDivision = getDivisionIdByBirthdate(member?.fechaNacimiento, divisions);

  return {
    ...member,
    idDivision: isPositiveNumber(idDivision) ? Number(idDivision) : (member?.idDivision ?? null),
  };
};

// Ninguna espera puede colgar el padron: es lo que resuelve la sesion al entrar.
// Si la estructura no llega a tiempo, se devuelve la lista sin acotar y se avisa;
// tener que esperar es peor que no acotar, porque deja a la gente fuera.
const TIEMPO_MAXIMO_ESTRUCTURA_MS = 4000;

const conTiempoLimite = (promesa, ms) =>
  Promise.race([
    promesa,
    new Promise((resolver) => {
      setTimeout(() => resolver({}), ms);
    }),
  ]).catch(() => ({}));

// La estructura con la que se resuelve a que seccion y region pertenece cada
// destacamento. Va por el cache de upstream, asi que no anade una peticion por
// cada consulta del padron.
const leerEstructura = async () => {
  const pedir = async (clave, url) => {
    const respuesta = await fetchUpstreamText(clave, url).catch(() => null);

    if (!respuesta?.text) return [];

    return getRowsFromNormalizedResponse(normalizeApiResponse(JSON.parse(respuesta.text)));
  };

  const [destacamentos, iglesias, secciones] = await Promise.all([
    pedir(UPSTREAM_KEYS.destacamentos, 'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos'),
    pedir(UPSTREAM_KEYS.iglesias, 'https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'),
    pedir(UPSTREAM_KEYS.secciones, 'https://systexploradores.somee.com/api/Secciones/GetAllSecciones'),
  ]);

  return { destacamentos, iglesias, secciones };
};

export async function GET(req) {
  try {
    // Sin sesion no se pasa. Esta ruta devuelve el padron completo —nombres,
    // correos, telefonos y fechas de nacimiento, menores incluidos— y hasta
    // ahora respondia a cualquiera: la usaban las pantallas de acceso, que no
    // tienen sesion. Ya no: lo que necesitan se resuelve en el servidor
    // (`/api/auth/correo-acceso`, `/api/auth/recuperacion`,
    // `/api/auth/correo-disponible`) y de ahi solo sale el dato concreto.
    // La sesion y quien es, en UNA sola consulta: identificar cuesta una llamada
    // a Firebase, y esta es la ruta que espera el inicio de sesion.
    const { error: sinSesion, quien } = await identificarConSesionRest(req);

    if (sinSesion) return sinSesion;

    const acceso = quien?.claims ?? {};
    const nivel = nivelDeAlcanceDeMiembros(acceso);

    // Reenviar la identidad del llamante al upstream para que autorice/filtre por
    // alcance (ver contrato en docs/seguridad-miembros-por-region.md). El caché se
    // particiona por token para no compartir resultados filtrados entre usuarios.
    const authHeader = req.headers.get('authorization') || '';
    const cacheKey = buildScopedUpstreamKey(UPSTREAM_KEYS.miembros, authHeader);

    const [rows, divisions] = await Promise.all([
      leerPadronPaginado({ cacheKey, authHeader }),
      getDivisions(),
    ]);

    // EL PADRON NO SALE ENTERO.
    //
    // El navegador ya decide a quien ve cada quien, pero eso solo ordena lo que
    // PINTA: la lista completa —telefonos, direcciones y fechas de nacimiento de
    // menores— ya habia viajado hasta el, y con el token se podia leer tal cual.
    // Aqui se aplica la misma regla al salir.
    //
    // Si no se puede resolver su alcance —sesion sin claims todavia, estructura
    // que no responde— se deja pasar la lista y se avisa por consola: dejar a
    // media organizacion con la pantalla vacia por no saber acotar seria peor
    // que el problema. El upstream sigue siendo la otra mitad de la respuesta.
    // La estructura solo hace falta para acotar por SECCION o por REGION: quien
    // se queda en su destacamento ya lo lleva en su token. Pedirla siempre le
    // sumaba tres peticiones al upstream a la ruta que espera el inicio de
    // sesion, y el upstream no tiene tiempo limite: bastaba con que tardara para
    // dejar a alguien mirando "Verificando tu acceso" para siempre.
    const estructura = ['seccion', 'region'].includes(nivel)
      ? await conTiempoLimite(leerEstructura(), TIEMPO_MAXIMO_ESTRUCTURA_MS)
      : {};
    const permitidos = miembrosDelAlcance({ acceso, miembros: rows, estructura });

    if (!permitidos) {
      console.warn('[api/members] no se pudo acotar el padron por alcance; se devuelve completo');
    }

    const visibles = permitidos ?? rows;

    return Response.json({
      data: visibles.map((member) => withCalculatedDivision(member, divisions)),
    });
  } catch (error) {
    const cause = error?.cause;
    const details = {
      message: error?.message || 'Error fetching members',
      code: cause?.code || error?.code || null,
    };

    console.error('[api/members] Error fetching members', details);

    return Response.json(
      {
        error: 'Error fetching members',
        ...(process.env.NODE_ENV === 'development' ? { details } : {}),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    // Borrar a un miembro sin sesion era posible: la ruta reenviaba la cabecera
    // solo SI venia, y sin ella llamaba igual al backend. Y tener sesion no
    // basta: eliminar miembros es cosa del Administrador Global —es lo que dice
    // la pantalla desde siempre—, asi que aqui se comprueba el ROL, no solo que
    // haya alguien al otro lado.
    const noAutorizado = await exigirAdministradorGlobalRest(req);

    if (noAutorizado) return noAutorizado;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'id es requerido' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const res = await fetch(
      `https://systexploradores.somee.com/api/Miembros/DeleteMiembro?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json, text/plain, */*',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      }
    );

    invalidateUpstream(UPSTREAM_KEYS.miembros);

    const text = await res.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return Response.json(
        { error: 'Error eliminando miembro', status: res.status, data },
        { status: res.status }
      );
    }

    return Response.json(normalizeApiResponse(data ?? { success: true }));
  } catch (error) {
    return Response.json({ error: error?.message || 'Error eliminando miembro' }, { status: 500 });
  }
}
