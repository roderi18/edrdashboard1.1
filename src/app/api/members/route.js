import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import {
  UPSTREAM_KEYS,
  fetchUpstreamText,
  invalidateUpstream,
  buildScopedUpstreamKey,
} from 'src/utils/upstream-cache';

import { getDivisions } from 'src/services/division-service';

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

export async function GET(req) {
  try {
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

    if (Array.isArray(normalized?.data)) {
      return Response.json({
        ...normalized,
        data: rows.map((member) => withCalculatedDivision(member, divisions)),
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
