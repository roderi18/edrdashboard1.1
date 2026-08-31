import { getStorageCollection, setStorageCollection } from 'src/utils/storage-service';
import {
  registrarFotoEntidadSubida,
  obtenerFotosPrincipalesPorEntidad,
} from 'src/utils/firebase-photos';
import {
  canEditRegional,
  canDeleteOrgLevel,
  puedeAprobarCambiosDeOrganizacion,
} from 'src/utils/org-level-access';

import { authHeaders } from './member-service';
import { compararCambios } from './sectional-service';
import { registrarAuditoriaSilenciosa } from './audit-log-service';
import { notificarFotoEntidadPropuesta } from './notificar-oficina-nacional-service';
import { AMBITOS_CAMBIO, ESTADOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';

const CAMPOS_REGION = {
  nombre: 'Nombre',
  regionalName: 'Nombre',
  correo: 'Correo',
  telefono: 'Teléfono',
  direccion: 'Dirección',
};

// Escritura real. No se llama a pelo: entra por la puerta de cambios.
const escribirRegion = async (payload) => {
  const res = await fetch('/api/regional/put/', {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  const texto = await res.text();

  if (!res.ok) {
    throw new Error(texto || `Error actualizando la región (${res.status})`);
  }

  return texto;
};

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
        const res = await fetch('/api/regional/');

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

    const res = await fetch('/api/regional/post/', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
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

    // Modificar una region lo aprueba la Oficina Nacional: no se escribe nada
    // hasta entonces.
    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.region,
        entidad: {
            tipo: 'region',
            id: payload?.idRegion ?? payload?.id ?? null,
            nombre: getRegionalAuditName(payload),
            ruta: '/dashboard/level/regional',
        },
        cambios: compararCambios(antes, payload, CAMPOS_REGION),
        usuario,
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload,
        aplicar: () => escribirRegion(payload),
    });

    if (resultado.estado === ESTADOS_CAMBIO.pendiente) {
        return { pendienteDeAprobacion: true, idSolicitud: resultado.idSolicitud };
    }

    return { pendienteDeAprobacion: false };
};

export const deleteRegional = async (id, { usuario, antes = null } = {}) => {
    assertScope(usuario, canDeleteOrgLevel(usuario), 'No tienes permiso para eliminar regiones.');

    const res = await fetch(`/api/regional/?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        // El token viaja: el servidor ya no borra por el mero hecho de que le
        // llegue la peticion, comprueba que quien la manda sea el Administrador
        // Global. Sin esta cabecera, el propio administrador se llevaria un 401.
        headers: await authHeaders(),
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

// ----------------------------------------------------------------------
// Foto de la region.
//
// La ficha de la region la edita la Oficina Nacional; los cargos regionales
// pasaron a consulta. La FOTO es otra cosa: sugerirla no es cambiarla. El
// Coordinador Regional y su Asistente conocen la imagen de su region antes que
// nadie, asi que pueden PROPONERLA por el mismo camino que la seccion y el
// destacamento —carpeta de propuestas, aviso con las dos imagenes, y la aplica
// quien resuelve—. La foto oficial no se mueve hasta que la Oficina Nacional o
// el Administrador Global la aceptan.
// ----------------------------------------------------------------------

export const proponerFotoRegion = async ({ region = {}, foto = {}, urlAntes = '', usuario = {} } = {}) => {
    const idRegion = region?.id ?? region?.idRegion ?? null;
    const payload = {
        idRegion,
        rutaArchivo: foto?.rutaArchivo || '',
        urlFoto: foto?.urlFoto || '',
        subidoPor: usuario?.uid || usuario?.id || '',
    };

    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.fotoRegion,
        entidad: {
            tipo: 'region',
            id: idRegion,
            nombre: region?.nombre || '',
            ruta: `/dashboard/level/regional/${idRegion ?? ''}/edit`,
        },
        cambios: [
            {
                campo: 'avatarUrl',
                etiqueta: 'Foto de la región',
                antes: urlAntes || null,
                despues: foto?.urlFoto || null,
            },
        ],
        usuario,
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload,
        aplicar: () => aplicarFotoRegion(payload),
    });

    const pendienteDeAprobacion = resultado.estado === ESTADOS_CAMBIO.pendiente;

    notificarFotoEntidadPropuesta({
        tipoEntidad: 'region',
        entidad: { id: idRegion, nombre: region?.nombre || '' },
        urlAntes,
        urlDespues: foto?.urlFoto || '',
        pendiente: pendienteDeAprobacion,
        usuario,
    }).catch((error) => {
        console.warn('[regiones] no se pudo avisar de la foto', error);
    });

    return { pendienteDeAprobacion, idSolicitud: resultado.idSolicitud || null };
};

// Al aprobarla, la propuesta pasa a ser la foto principal. Se apunta al archivo
// que ya se subio: no se vuelve a subir nada.
export const aplicarFotoRegion = async (payload = {}) =>
    registrarFotoEntidadSubida({
        tipoEntidad: 'region',
        idEntidad: payload?.idRegion,
        tipoFoto: 'perfil',
        rutaArchivo: payload?.rutaArchivo || '',
        urlFoto: payload?.urlFoto || '',
        subidoPor: payload?.subidoPor || '',
    });
