import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { canEditRegional, canDeleteOrgLevel } from 'src/utils/org-level-access';
import { getStorageCollection, setStorageCollection } from 'src/utils/storage-service';

import { registrarAuditoriaSilenciosa } from './audit-log-service';

// Verificacion de alcance del lado del cliente (defensa en profundidad). Solo se
// aplica cuando el llamador pasa `usuario`; mitigacion parcial (la API externa
// no valida permisos).
const assertScope = (usuario, allowed, mensaje) => {
  if (usuario && !allowed) {
    throw new Error(mensaje);
  }
};

const REGIONALS_STORAGE_KEY = 'regionals';

function mapApiRegionalToUI(regional) {
    return {
        id: String(regional.idRegion || regional.id),

        regionalName: regional.nombre || '',
        name: regional.nombre,
        regionId: String(regional.idRegion || regional.id),
        countryId: String(regional.idPais || regional.countryId || ''),
        idPais: regional.idPais || regional.countryId || null,
        email: regional.correo || regional.email || '',

        avatarUrl: null,
        coverUrl: null,

        regionalXSectionalCount: regional.regionalXSectionalCount || 0,
        regionalXSectionalXDestCount: regional.regionalXSectionalXDestCount || 0,
        regionalXSectionalMemberCount: 0,

        memberFullName: 'Desconocido',
        directorId: null,

        status: 'active',
    };
}

export const getCachedRegionals = () => getStorageCollection(REGIONALS_STORAGE_KEY) || [];

export const getRegionals = async ({ includePhotos = true } = {}) => {
    try {
        const res = await fetch('/api/regional');

        if (!res.ok) {
            await res.text();
            throw new Error('Error al obtener regionales');
        }

        const response = await res.json();

        const data = response.data || response.Data || [];
        const mappedRegionals = Array.isArray(data) ? data.map(mapApiRegionalToUI) : [];
        const photosByRegionalId = includePhotos
            ? await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'region' })
            : {};

        const resolvedRegionals = mappedRegionals.map((regional) => ({
            ...regional,
            avatarUrl: photosByRegionalId[String(regional.id)]?.urlFoto || regional.avatarUrl || null,
        }));

        setStorageCollection(REGIONALS_STORAGE_KEY, resolvedRegionals);

        return resolvedRegionals;
    } catch (error) {
        console.error('getRegionals error:', error);
        return getCachedRegionals();
    }
};

const getRegionalAuditName = (regional = {}) =>
    regional.nombre || regional.regionalName || regional.name || 'Región';

const registrarAuditoriaRegional = ({
    accion,
    descripcion,
    payload,
    usuario,
    antes = null,
    severidad = 'informativa',
}) => {
    registrarAuditoriaSilenciosa({
        modulo: 'regiones',
        accion,
        descripcion,
        severidad,
        entidad: {
            tipo: 'region',
            id: payload?.idRegion || payload?.id,
            nombre: getRegionalAuditName(payload),
            ruta: payload?.idRegion || payload?.id
                ? `/dashboard/level/regional/${payload?.idRegion || payload?.id}/edit`
                : '/dashboard/level/regional',
        },
        antes,
        despues: payload,
        realizadoPor: usuario,
        origen: 'niveles_organizacionales',
    });
};

export const saveRegional = async (payload, { usuario } = {}) => {
    // Crear regiones queda reservado a los administradores global/funcional.
    assertScope(usuario, canDeleteOrgLevel(usuario), 'No tienes permiso para crear regiones.');

    const res = await fetch('/api/regional/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!text || text.startsWith('<')) {
        registrarAuditoriaRegional({
            accion: 'region_creada',
            descripcion: `Se creó la región ${getRegionalAuditName(payload)}.`,
            payload,
            usuario,
        });
        return {};
    }

    const response = JSON.parse(text);
    registrarAuditoriaRegional({
        accion: 'region_creada',
        descripcion: `Se creó la región ${getRegionalAuditName(payload)}.`,
        payload: { ...payload, ...response },
        usuario,
    });

    return response;
};

export const updateRegional = async (payload, { usuario, antes = null } = {}) => {
    assertScope(
        usuario,
        canEditRegional(usuario, antes ?? payload),
        'No tienes permiso para editar esta región.'
    );

    const res = await fetch('/api/regional/put', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!text || text.startsWith('<')) {
        registrarAuditoriaRegional({
            accion: 'region_actualizada',
            descripcion: `Se actualizó la región ${getRegionalAuditName(payload)}.`,
            payload,
            usuario,
            antes,
        });
        return {};
    }

    const response = JSON.parse(text);
    registrarAuditoriaRegional({
        accion: 'region_actualizada',
        descripcion: `Se actualizó la región ${getRegionalAuditName(payload)}.`,
        payload: { ...payload, ...response },
        usuario,
        antes,
    });

    return response;
};

export const deleteRegional = async (id, { usuario, antes = null } = {}) => {
    assertScope(usuario, canDeleteOrgLevel(usuario), 'No tienes permiso para eliminar regiones.');

    const res = await fetch(`/api/regional?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || `Error eliminando regional (${res.status})`);
    }

    registrarAuditoriaRegional({
        accion: 'region_eliminada',
        descripcion: `Se eliminó la región ${getRegionalAuditName(antes)}.`,
        payload: { ...(antes || {}), idRegion: id },
        usuario,
        antes,
        severidad: 'importante',
    });

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};
