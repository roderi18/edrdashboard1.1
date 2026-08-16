import { getOwnRegionIdsForUser } from 'src/utils/member-access';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getStorageCollection, setStorageCollection } from 'src/utils/storage-service';
import {
  canEditSectional,
  canDeleteOrgLevel,
  canAssignSectionalToRegion,
  canCreateSectionalInRegion,
} from 'src/utils/org-level-access';

import { getChurches } from './church-service';
import { registrarAuditoriaSilenciosa } from './audit-log-service';

// Verificacion de alcance del lado del cliente (defensa en profundidad). Solo se
// aplica cuando el llamador pasa `usuario`; es una mitigacion parcial: la API
// externa no valida permisos, asi que el control real debe vivir en el backend.
const assertScope = (usuario, allowed, mensaje) => {
  if (usuario && !allowed) {
    throw new Error(mensaje);
  }
};

// Region(es) propias del usuario, DERIVADAS (no solo el alcance del token, que
// muchas sesiones no traen resuelto). Los destacamentos se piden por fetch y no
// via dest-service para no crear un ciclo de importacion entre ambos servicios.
const resolveOwnRegionIds = async (usuario) => {
  try {
    const [sectionals, churches] = await Promise.all([
      getSectionals({ includePhotos: false }),
      getChurches(),
    ]);

    let dests = [];

    try {
      const res = await fetch('/api/dest');
      const json = await res.json();
      dests = Array.isArray(json?.data) ? json.data : Array.isArray(json?.Data) ? json.Data : [];
    } catch {
      dests = [];
    }

    return getOwnRegionIdsForUser(usuario, { dests, churches, sectionals });
  } catch (error) {
    // No poder comprobar el alcance no autoriza: se devuelve vacio y se deniega.
    console.warn('[sectional-service] no se pudo resolver la region propia', error);

    return new Set();
  }
};

const SECTIONALS_STORAGE_KEY = 'sectionals';

function mapApiSectionalToUI(sectional) {
    return {
        id: String(sectional.idSeccion || sectional.id),

        // 🔥 AGREGA ESTA LÍNEA
        idSeccion: String(sectional.idSeccion || sectional.id || ''),

        sectionalName: sectional.nombre || sectional.sectionalName || '',
        email: sectional.correo || sectional.email || '',

        regionalId: String(sectional.idRegion || sectional.regionalId || ''),

        directorId: sectional.idDirector ? String(sectional.idDirector) : '',

        avatarUrl: null,
        coverUrl: null,

        sectionalDestCount: sectional.sectionalDestCount || 0,
        sectionalXDestMemberCount: 0,
        // sectionalChurchCount: sectional.cantidadIglesias || 0,
        memberFullName: 'Desconocido',

        status: 'active',
    };
}

export const getCachedSectionals = () => getStorageCollection(SECTIONALS_STORAGE_KEY) || [];

export const getSectionals = async ({ includePhotos = true } = {}) => {
    try {
        const res = await fetch('/api/sectional');

        if (!res.ok) throw new Error('Error al obtener seccionales');

        const response = await res.json();

        const data = response.data || response.Data || response;

        const mappedSectionals = Array.isArray(data)
            ? data.map(mapApiSectionalToUI)
            : [];
        const photosBySectionalId = includePhotos
            ? await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'seccion' })
            : {};

        const resolvedSectionals = mappedSectionals.map((sectional) => ({
            ...sectional,
            avatarUrl: photosBySectionalId[String(sectional.id)]?.urlFoto || sectional.avatarUrl || null,
        }));

        setStorageCollection(SECTIONALS_STORAGE_KEY, resolvedSectionals);

        return resolvedSectionals;
    } catch (error) {
        console.error('getSectionals error:', error);
        return getCachedSectionals();
    }
};

export const getSectionalById = async (id) => {
    const sectionals = await getSectionals();
    return sectionals.find((item) => item.id === id) || null;
};

export const getSectionalNameById = async (id) => {
    const sectional = await getSectionalById(id);
    return sectional?.sectionalName || 'Sección desconocida';
};

const getSectionalAuditName = (sectional = {}) =>
    sectional.nombre || sectional.sectionalName || sectional.name || 'Sección';

const registrarAuditoriaSeccion = ({
    accion,
    descripcion,
    payload,
    usuario,
    antes = null,
    severidad = 'informativa',
}) => {
    registrarAuditoriaSilenciosa({
        modulo: 'secciones',
        accion,
        descripcion,
        severidad,
        entidad: {
            tipo: 'seccion',
            id: payload?.idSeccion || payload?.id,
            nombre: getSectionalAuditName(payload),
            ruta: payload?.idSeccion || payload?.id
                ? `/dashboard/level/sectional/${payload?.idSeccion || payload?.id}/edit`
                : '/dashboard/level/sectional',
        },
        antes,
        despues: payload,
        realizadoPor: usuario,
        origen: 'niveles_organizacionales',
    });
};

export const saveSectional = async (payload, { usuario } = {}) => {
    // Se valida contra la REGION DESTINO del payload, con el alcance propio ya
    // derivado (el token de un Coordinador Regional puede no traer su region).
    if (usuario) {
        const ownRegionIds = await resolveOwnRegionIds(usuario);

        assertScope(
            usuario,
            canCreateSectionalInRegion(usuario, payload?.idRegion ?? payload?.regionalId, {
                ownRegionIds,
            }),
            'Solo puedes crear secciones dentro de tu región.'
        );
    }

    const res = await fetch('/api/sectional/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();

    registrarAuditoriaSeccion({
        accion: 'seccion_creada',
        descripcion: `Se creó la sección ${getSectionalAuditName(payload)}.`,
        payload: { ...payload, ...data },
        usuario,
    });

    return data;
};

export const updateSectional = async (sectional, { usuario, antes = null } = {}) => {
    if (usuario) {
        const ownRegionIds = await resolveOwnRegionIds(usuario);

        assertScope(
            usuario,
            canEditSectional(usuario, antes ?? sectional) &&
                canAssignSectionalToRegion(usuario, sectional?.idRegion ?? sectional?.regionalId, {
                    ownRegionIds,
                }),
            'No tienes permiso para editar esta sección.'
        );
    }

    try {
        const res = await fetch('/api/sectional/put', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sectional),
        });

        const text = await res.text();

        if (!text) {
            registrarAuditoriaSeccion({
                accion: 'seccion_actualizada',
                descripcion: `Se actualizó la sección ${getSectionalAuditName(sectional)}.`,
                payload: sectional,
                usuario,
                antes,
            });
            return {};
        }

        if (text.startsWith('<')) {
            registrarAuditoriaSeccion({
                accion: 'seccion_actualizada',
                descripcion: `Se actualizó la sección ${getSectionalAuditName(sectional)}.`,
                payload: sectional,
                usuario,
                antes,
            });
            return {};
        }

        const data = JSON.parse(text);
        registrarAuditoriaSeccion({
            accion: 'seccion_actualizada',
            descripcion: `Se actualizó la sección ${getSectionalAuditName(sectional)}.`,
            payload: { ...sectional, ...data },
            usuario,
            antes,
        });

        return data;
    } catch (error) {
        console.error('Error actualizando seccional:', error);
        return {};
    }
};

export const deleteSectional = async (id, { usuario, antes = null } = {}) => {
    assertScope(
        usuario,
        canDeleteOrgLevel(usuario),
        'No tienes permiso para eliminar secciones.'
    );

    const res = await fetch(`/api/sectional?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || `Error eliminando seccional (${res.status})`);
    }

    registrarAuditoriaSeccion({
        accion: 'seccion_eliminada',
        descripcion: `Se eliminó la sección ${getSectionalAuditName(antes)}.`,
        payload: { ...(antes || {}), idSeccion: id },
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
