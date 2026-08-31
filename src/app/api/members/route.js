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
import { miembrosDelAlcance } from 'src/server/alcance-miembros-core.mjs';
import {
  exigirSesionRest,
  identificarPorRest,
  exigirAdministradorGlobalRest,
} from 'src/server/sesion-rest.mjs';

const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

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

const withCalculatedDivision = (member, divisions) => {
  if (isPositiveNumber(member?.idDivision)) return member;

  const idDivision = getDivisionIdByBirthdate(member?.fechaNacimiento, divisions);

  return {
    ...member,
    idDivision: isPositiveNumber(idDivision) ? Number(idDivision) : (member?.idDivision ?? null),
  };
};

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
    const sinSesion = await exigirSesionRest(req);

    if (sinSesion) return sinSesion;

    // Reenviar la identidad del llamante al upstream para que autorice/filtre por
    // alcance (ver contrato en docs/seguridad-miembros-por-region.md). El caché se
    // particiona por token para no compartir resultados filtrados entre usuarios.
    const authHeader = req.headers.get('authorization') || '';
    const cacheKey = buildScopedUpstreamKey(UPSTREAM_KEYS.miembros, authHeader);

    const [upstream, divisions] = await Promise.all([
      fetchUpstreamText(
        cacheKey,
        'https://systexploradores.somee.com/api/Miembros/GetAllMiembros',
        authHeader
          ? { init: { headers: { Authorization: authHeader, Accept: 'application/json' } } }
          : undefined
      ),
      getDivisions(),
    ]);

    const data = JSON.parse(upstream.text);
    const normalized = normalizeApiResponse(data);
    const rows = getRowsFromNormalizedResponse(normalized);

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
    const quien = await identificarPorRest(req).catch(() => null);
    const acceso = quien?.claims ?? {};
    const permitidos = await leerEstructura()
      .then((estructura) => miembrosDelAlcance({ acceso, miembros: rows, estructura }))
      .catch(() => null);

    if (!permitidos) {
      console.warn('[api/members] no se pudo acotar el padron por alcance; se devuelve completo');
    }

    const visibles = permitidos ?? rows;

    if (Array.isArray(normalized?.data)) {
      return Response.json({
        ...normalized,
        data: visibles.map((member) => withCalculatedDivision(member, divisions)),
      });
    }

    return Response.json(normalized);
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
