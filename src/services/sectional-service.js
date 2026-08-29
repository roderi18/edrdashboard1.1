import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

import { getOwnRegionIdsForUser } from 'src/utils/member-access';
import { getStorageCollection, setStorageCollection } from 'src/utils/storage-service';
import {
    registrarFotoEntidadSubida,
    obtenerFotosPrincipalesPorEntidad,
} from 'src/utils/firebase-photos';
import {
    canEditSectional,
    canDeleteOrgLevel,
    canAssignSectionalToRegion,
    canCreateSectionalInRegion,
    soloSugiereCambiosDeSeccion,
    puedeAsignarLaRegionDeUnaSeccion,
    puedeAprobarCambiosDeOrganizacion,
} from 'src/utils/org-level-access';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { getChurches } from './church-service';
import { authHeaders } from './member-service';
import { registrarAuditoriaSilenciosa } from './audit-log-service';
import { notificarFotoEntidadPropuesta } from './notificar-oficina-nacional-service';
import { AMBITOS_CAMBIO, ESTADOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';

// Campos que se listan en la propuesta, para que quien apruebe vea QUE cambia.
const CAMPOS_SECCION = {
    nombre: 'Nombre',
    sectionalName: 'Nombre',
    idRegion: 'Región',
    regionalId: 'Región',
    correo: 'Correo',
    telefono: 'Teléfono',
    direccion: 'Dirección',
};

export const compararCambios = (antes, despues, campos) =>
    Object.entries(campos)
        .map(([campo, etiqueta]) => ({
            campo,
            etiqueta,
            antes: antes?.[campo] ?? null,
            despues: despues?.[campo] ?? null,
        }))
        .filter((cambio) => String(cambio.antes ?? '') !== String(cambio.despues ?? ''));

// Escritura real. No se llama a pelo: entra por la puerta de cambios.
const escribirSeccion = async (sectional) => {
    const res = await fetch('/api/sectional/put', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectional),
    });

    const texto = await res.text();

    if (!res.ok) {
        throw new Error(texto || `Error actualizando la sección (${res.status})`);
    }

    return texto;
};

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
    // Quien APRUEBA no se pide permiso a si mismo: al aplicar un alta ya
    // aprobada, la escritura la ejecuta la Oficina Nacional, cuya region no es
    // la de la seccion propuesta.
    if (usuario && !puedeAprobarCambiosDeOrganizacion(usuario)) {
        const ownRegionIds = await resolveOwnRegionIds(usuario);

        assertScope(
            usuario,
            canCreateSectionalInRegion(usuario, payload?.idRegion ?? payload?.regionalId, {
                ownRegionIds,
            }),
            'Solo puedes crear secciones dentro de tu región.'
        );
    }

    // DAR DE ALTA UNA SECCION LO APRUEBA LA OFICINA NACIONAL, igual que
    // modificarla. Los cargos de region pueden proponerla —es su region y son
    // quienes saben que hace falta— pero no crearla de su mano: una seccion
    // nueva cambia el mapa de la organizacion.
    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.seccion,
        entidad: {
            tipo: 'seccion',
            // Todavia no tiene id: lo tendra cuando se apruebe y se cree.
            id: null,
            nombre: getSectionalAuditName(payload),
            ruta: '/dashboard/level/sectional',
        },
        cambios: [
            {
                campo: 'nombre',
                etiqueta: 'Sección nueva',
                antes: null,
                despues: getSectionalAuditName(payload),
            },
            {
                campo: 'idRegion',
                etiqueta: 'Región',
                antes: null,
                despues: payload?.idRegion ?? payload?.regionalId ?? null,
            },
        ],
        usuario,
        descripcion: `Se creó la sección ${getSectionalAuditName(payload)}.`,
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload,
        aplicar: () => crearSeccionEnLaApi(payload),
    });

    if (resultado.estado === ESTADOS_CAMBIO.pendiente) {
        return { pendienteDeAprobacion: true, idSolicitud: resultado.idSolicitud };
    }

    return { pendienteDeAprobacion: false };
};

// La escritura real del alta. No se llama a pelo: entra por la puerta de
// cambios, que la ejecuta ahora o al aprobarla.
const crearSeccionEnLaApi = async (payload) => {
    const res = await fetch('/api/sectional/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const texto = await res.text();

        throw new Error(texto || `Error creando la sección (${res.status})`);
    }

    return res.json();
};

export const updateSectional = async (sectional, { usuario, antes = null } = {}) => {
    // La REGION de la seccion no la mueve ningun cargo de seccion. El
    // desplegable ya viene cerrado en el formulario; esto es lo que lo hace
    // cierto: se conserva la region que tenia, asi que un formulario viejo —o
    // una llamada armada a mano— no puede mudar la seccion de region ni dejar
    // esa propuesta esperando en la bandeja de la Oficina Nacional.
    const regionAnterior = antes?.idRegion ?? antes?.regionalId ?? null;
    const cambio =
        usuario && !puedeAsignarLaRegionDeUnaSeccion(usuario) && regionAnterior != null
            ? { ...sectional, idRegion: Number(regionAnterior) }
            : sectional;

    if (usuario) {
        const ownRegionIds = await resolveOwnRegionIds(usuario);

        assertScope(
            usuario,
            canEditSectional(usuario, antes ?? cambio) &&
            canAssignSectionalToRegion(usuario, cambio?.idRegion ?? cambio?.regionalId, {
                ownRegionIds,
            }),
            'No tienes permiso para editar esta sección.'
        );
    }

    // Modificar una seccion lo aprueba la Oficina Nacional: no se escribe nada
    // hasta entonces.
    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.seccion,
        entidad: {
            tipo: 'seccion',
            id: cambio?.idSeccion ?? cambio?.id ?? null,
            nombre: getSectionalAuditName(cambio),
            ruta: '/dashboard/level/sectional',
        },
        cambios: compararCambios(antes, cambio, CAMPOS_SECCION),
        usuario,
        // El Sub-Coordinador maneja los mismos campos que su Coordinador, pero
        // lo suyo se registra como sugerencia: no habla por la seccion.
        esSugerencia: soloSugiereCambiosDeSeccion(usuario),
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload: cambio,
        aplicar: () => escribirSeccion(cambio),
    });

    if (resultado.estado === ESTADOS_CAMBIO.pendiente) {
        return { pendienteDeAprobacion: true, idSolicitud: resultado.idSolicitud };
    }

    return { pendienteDeAprobacion: false };
};

export const deleteSectional = async (id, { usuario, antes = null } = {}) => {
    assertScope(
        usuario,
        canDeleteOrgLevel(usuario),
        'No tienes permiso para eliminar secciones.'
    );

    const res = await fetch(`/api/sectional?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        // El token viaja: el servidor ya no borra por el mero hecho de que le
        // llegue la peticion, comprueba que quien la manda sea el Administrador
        // Global. Sin esta cabecera, el propio administrador se llevaria un 401.
        headers: await authHeaders(),
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

// ----------------------------------------------------------------------
// Segundo nombre de la seccion ("Nombre 2 de la Sección").
//
// La API de Secciones solo guarda UN nombre, asi que el segundo vive en
// Firestore, en un documento por seccion identificado por su id:
// `seccionesNombres/seccion_<idSeccion>`. El id va tambien como campo, para
// poder cruzarlo sin depender del nombre del documento.
// ----------------------------------------------------------------------

export const COLECCION_NOMBRES_SECCION = 'seccionesNombres';

const normalizarIdSeccion = (idSeccion) => String(idSeccion ?? '').trim();

export const idDocumentoNombreSeccion = (idSeccion) =>
    `seccion_${normalizarIdSeccion(idSeccion)}`;

export const obtenerNombreSecundarioSeccion = async (idSeccion) => {
    const id = normalizarIdSeccion(idSeccion);

    if (!isFirebaseConfigured || !FIRESTORE || !id) return '';

    const snapshot = await getDoc(doc(FIRESTORE, COLECCION_NOMBRES_SECCION, idDocumentoNombreSeccion(id)));

    return snapshot.exists() ? String(snapshot.data()?.nombreSecundario || '') : '';
};

// Todos de una vez, indexados por id de seccion: quien los necesite para una
// lista no tiene que pedir uno por fila.
export const obtenerNombresSecundariosSeccion = async () => {
    if (!isFirebaseConfigured || !FIRESTORE) return {};

    const snapshot = await getDocs(collection(FIRESTORE, COLECCION_NOMBRES_SECCION));
    const nombres = {};

    snapshot.forEach((documento) => {
        const datos = documento.data() || {};
        const id = normalizarIdSeccion(datos.idSeccion);

        if (id) nombres[id] = String(datos.nombreSecundario || '');
    });

    return nombres;
};

// Escritura real. No se llama a pelo: entra por la puerta de cambios.
const escribirNombreSecundario = async ({ id, nombre, usuario }) =>
    setDoc(
        doc(FIRESTORE, COLECCION_NOMBRES_SECCION, idDocumentoNombreSeccion(id)),
        {
            idSeccion: id,
            nombreSecundario: nombre,
            actualizadoPor: usuario?.uid || usuario?.id || null,
            actualizadoEn: serverTimestamp(),
        },
        { merge: true }
    );

export const guardarNombreSecundarioSeccion = async ({
    idSeccion,
    nombreSecundario,
    nombreSeccion = '',
    antes = '',
    usuario,
} = {}) => {
    if (!isFirebaseConfigured || !FIRESTORE) {
        throw new Error('Firebase no está configurado en este entorno.');
    }

    const id = normalizarIdSeccion(idSeccion);

    if (!id) {
        throw new Error('No se pudo identificar la sección para guardar su segundo nombre.');
    }

    const nombre = String(nombreSecundario ?? '').trim();
    const anterior = String(antes ?? '').trim();

    // Sin cambios no se molesta a nadie: ni solicitud, ni escritura.
    if (nombre === anterior) {
        return { pendienteDeAprobacion: false, idSeccion: id, nombreSecundario: nombre };
    }

    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.seccion,
        entidad: {
            tipo: 'seccion',
            id,
            nombre: nombreSeccion || `Sección ${id}`,
            ruta: `/dashboard/level/sectional/${id}/edit`,
        },
        cambios: [
            {
                campo: 'nombreSecundario',
                etiqueta: 'Nombre secundario de Sección',
                antes: anterior || null,
                despues: nombre || null,
            },
        ],
        usuario,
        descripcion: `Se cambió el segundo nombre de la sección ${nombreSeccion || id}.`,
        esSugerencia: soloSugiereCambiosDeSeccion(usuario),
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload: { idSeccion: id, nombreSecundario: nombre },
        aplicar: () => escribirNombreSecundario({ id, nombre, usuario }),
    });

    return {
        idSeccion: id,
        nombreSecundario: nombre,
        pendienteDeAprobacion: resultado.estado === ESTADOS_CAMBIO.pendiente,
        idSolicitud: resultado.idSolicitud,
    };
};

// ----------------------------------------------------------------------
// Foto de la seccion.
//
// La ficha de la seccion la edita su Coordinador titular, pero la FOTO la puede
// sugerir tambien el Sub-Coordinador: no es cambiar la seccion, es proponer una
// imagen. Va por el mismo camino que la del destacamento —carpeta de propuestas,
// aviso con las dos imagenes, y la aplica quien aprueba—, asi que la foto oficial
// no cambia hasta que la Oficina Nacional o el Administrador Global lo aceptan.
// ----------------------------------------------------------------------

export const proponerFotoSeccion = async ({ seccion = {}, foto = {}, urlAntes = '', usuario = {} } = {}) => {
    const idSeccion = seccion?.id ?? seccion?.idSeccion ?? null;
    const payload = {
        idSeccion,
        rutaArchivo: foto?.rutaArchivo || '',
        urlFoto: foto?.urlFoto || '',
        subidoPor: usuario?.uid || usuario?.id || '',
    };

    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.fotoSeccion,
        entidad: {
            tipo: 'seccion',
            id: idSeccion,
            nombre: seccion?.nombre || '',
            ruta: `/dashboard/level/sectional/${idSeccion ?? ''}/edit`,
        },
        cambios: [
            {
                campo: 'avatarUrl',
                etiqueta: 'Foto de la sección',
                antes: urlAntes || null,
                despues: foto?.urlFoto || null,
            },
        ],
        usuario,
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload,
        aplicar: () => aplicarFotoSeccion(payload),
    });

    const pendienteDeAprobacion = resultado.estado === ESTADOS_CAMBIO.pendiente;

    notificarFotoEntidadPropuesta({
        tipoEntidad: 'seccion',
        entidad: { id: idSeccion, nombre: seccion?.nombre || '' },
        urlAntes,
        urlDespues: foto?.urlFoto || '',
        pendiente: pendienteDeAprobacion,
        usuario,
    }).catch((error) => {
        console.warn('[secciones] no se pudo avisar de la foto', error);
    });

    return { pendienteDeAprobacion, idSolicitud: resultado.idSolicitud || null };
};

// Al aprobarla, la propuesta pasa a ser la foto principal. Se apunta al archivo
// que ya se subio: no se vuelve a subir nada.
export const aplicarFotoSeccion = async (payload = {}) =>
    registrarFotoEntidadSubida({
        tipoEntidad: 'seccion',
        idEntidad: payload?.idSeccion,
        tipoFoto: 'perfil',
        rutaArchivo: payload?.rutaArchivo || '',
        urlFoto: payload?.urlFoto || '',
        subidoPor: payload?.subidoPor || '',
    });
