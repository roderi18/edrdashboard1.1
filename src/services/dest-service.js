import { getOwnRegionIdsForUser, getOwnSectionIdsForUser } from 'src/utils/member-access';
import {
    saveItem,
    getStorageCollection,
    setStorageCollection,
} from 'src/utils/storage-service';
import {
    registrarFotoEntidadSubida,
    obtenerFotosPrincipalesPorEntidad,
} from 'src/utils/firebase-photos';
import {
    isFullOrgManager,
    canCreateDestInSection,
    soloSugiereAltasDeDestacamento,
    puedeAprobarCambiosDeOrganizacion,
} from 'src/utils/org-level-access';

import { getChurches } from './church-service';
import { getSectionals } from './sectional-service';
import { registrarAuditoriaSilenciosa } from './audit-log-service';
import {
    AMBITOS_CAMBIO,
    ESTADOS_CAMBIO,
    proponerCambio,
} from './solicitudes-cambio-service';
import {
    notificarFotoEntidadPropuesta,
    notificarDestacamentoActualizado,
} from './notificar-oficina-nacional-service';

// Campos del destacamento que se listan en la propuesta, para que quien la
// apruebe vea QUE cambia y no solo que "hubo cambios".
const CAMPOS_DESTACAMENTO = {
    name: 'Nombre',
    destNumber: 'Número',
    churchId: 'Iglesia',
    correo: 'Correo',
    telefono: 'Teléfono',
    direccion: 'Dirección',
    destMeetingDays: 'Día de reunión',
    destMeetingTimes: 'Hora de reunión',
    registradoOfnc: 'Registrado en Oficina Nacional',
    rritrackActivo: 'RRITrack activo',
};

const compararParaHistorial = (antes, despues, campos = CAMPOS_DESTACAMENTO) =>
    Object.entries(campos)
        .map(([campo, etiqueta]) => ({
            campo,
            etiqueta,
            antes: antes?.[campo] ?? null,
            despues: despues?.[campo] ?? null,
        }))
        .filter((cambio) => String(cambio.antes ?? '') !== String(cambio.despues ?? ''));

// Verificacion de alcance del lado del cliente (defensa en profundidad), aplicada
// solo cuando el llamador pasa `usuario`. La edicion fina por alcance vive en el
// formulario (estaDentroDelAlcance); aqui se cubren crear y eliminar.
const assertScope = (usuario, allowed, mensaje) => {
    if (usuario && !allowed) {
        throw new Error(mensaje);
    }
};

// Alcance propio del usuario + region de la seccion destino, para validar un alta
// de destacamento contra el destino REAL. Los ids propios se DERIVAN (membresia,
// destacamento -> iglesia -> seccion -> region), no solo del token, porque muchas
// sesiones no traen el alcance resuelto y sin esto se denegarian altas legitimas.
const resolveDestCreationScope = async (usuario, sectionId) => {
    try {
        const [sectionals, churches, dests] = await Promise.all([
            getSectionals({ includePhotos: false }),
            getChurches(),
            getDestsApi(),
        ]);

        const sectional =
            sectionId === null || sectionId === undefined || sectionId === ''
                ? null
                : (Array.isArray(sectionals) ? sectionals : []).find((item) =>
                      [item?.id, item?.idSeccion].some(
                          (value) => String(value) === String(sectionId)
                      )
                  );

        return {
            regionId: sectional?.regionalId ?? sectional?.idRegion ?? sectional?.regionId ?? null,
            ownSectionIds: getOwnSectionIdsForUser(usuario, { dests, churches }),
            ownRegionIds: getOwnRegionIdsForUser(usuario, { dests, churches, sectionals }),
        };
    } catch (error) {
        // Sin los catalogos no se puede comprobar el destino. No poder verificar no
        // autoriza: se devuelven alcances vacios y la validacion deniega.
        console.warn('[dest-service] no se pudo resolver el alcance del alta', error);

        return { regionId: null, ownSectionIds: new Set(), ownRegionIds: new Set() };
    }
};

const DESTS_STORAGE_KEY = 'dests';
// ------------------------------------------------------------
// DESTS
// ------------------------------------------------------------

const normalizePhoneToE164 = (value) => {
    const phone = String(value ?? '').trim();

    if (!phone) return '';
    if (phone.startsWith('+')) return phone;

    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

    return phone;
};

export const mapApiDestToUI = (apiDest) => ({
        id: apiDest.idDestacamento ? String(apiDest.idDestacamento) : null,

        name: apiDest.nombre ?? '',
        destNumber: apiDest.numero ?? '',

        avatarUrl: apiDest.logo ?? null,

        coordinatorId: null,

        churchId: apiDest.idIglesia?.toString() ?? null,

        correo: apiDest.correo ?? '',
        telefono: normalizePhoneToE164(apiDest.telefono),
        direccion: apiDest.direccion ?? '',
        concilio: apiDest.concilio ?? '',
        fechaInicio: apiDest.fechaInicio ?? '',
        registradoOfnc: apiDest.registradoOfnc ?? true,
        rritrackActivo: apiDest.rritrackActivo ?? false,

        country: '',

        destMeetingDays: apiDest.diaReunion ?? '',
        destMeetingTimes: apiDest.horaReunion ?? '',

        membershipStatus:
            apiDest.registradoOfnc === null
                ? 'active'
                : apiDest.registradoOfnc
                    ? 'active'
                    : 'banned',

        isVerified: apiDest.rritrackActivo ?? true,

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
export function saveDest(dest) {
    saveItem(DESTS_STORAGE_KEY, dest);
}

export function getDests() {
    return getStorageCollection(DESTS_STORAGE_KEY) || [];
}

export async function getDestsApi({ includePhotos = true } = {}) {
    try {
        const res = await fetch('/api/dest');

        const text = await res.text();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            console.error('❌ DEST NO JSON:', text);
            return [];
        }

        const data = parsed?.data || parsed?.Data || parsed;
        const mappedDests = Array.isArray(data)
            ? data.map(mapApiDestToUI)
            : [];
        const photosByDestId = includePhotos
            ? await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'destacamento' })
            : {};
        const localDests = getDests();
        const localDestsById = new Map(
            localDests
                .filter((dest) => dest?.id)
                .map((dest) => [String(dest.id), dest])
        );

        const resolvedDests = mappedDests.map((dest) => {
            const localDest = localDestsById.get(String(dest.id));

            return {
                ...dest,
                coordinatorId: localDest?.coordinatorId ?? dest.coordinatorId ?? null,
                avatarUrl:
                    photosByDestId[String(dest.id)]?.urlFoto ||
                    localDest?.avatarUrl ||
                    dest.avatarUrl ||
                    null,
            };
        });

        setStorageCollection(DESTS_STORAGE_KEY, resolvedDests);

        return resolvedDests;
    } catch (error) {
        console.error('❌ ERROR DEST API:', error);
        return [];
    }
}

export function getDestById(id) {
    const dests = getDests();
    return dests.find((d) => d.id === id);
}

const normalizePhoneForApi = (value) => String(value ?? '').replace(/\D/g, '');

const normalizeDateTimeForApi = (value) => {
    if (!value) return new Date().toISOString().slice(0, 19);

    return String(value).replace('Z', '').split('.')[0];
};

export const buildDestPayload = (data) => ({
    idDestacamento: Number(data?.idDestacamento || data?.id || 0),
    nombre: data?.name?.trim() || 'name',
    idIglesia: Number(data.churchId) || (() => { throw new Error('idIglesia es requerido'); })(),
    correo:
        data?.correo?.trim() ||
        `nomail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}@mail.com`,
    telefono: normalizePhoneForApi(data?.telefono),

    direccion:
        data?.direccion?.trim() ||
        data?.address?.trim() ||
        'N/A',

    concilio: data?.concilio?.trim() || 'N/A',
    registradoOfnc: data?.registradoOfnc ?? null,
    rritrackActivo: data?.rritrackActivo ?? null,

    diaReunion: data?.destMeetingDays?.trim() || '',

    horaReunion: data?.destMeetingTimes
        ? (data.destMeetingTimes.includes(':')
            ? (data.destMeetingTimes.length === 5
                ? `${data.destMeetingTimes}:00`
                : data.destMeetingTimes)
            : `${data.destMeetingTimes}:00:00`)
        : '',

    logo: data?.logo?.trim() || '',

    numero: data?.destNumber?.trim() || '',

    fechaInicio: normalizeDateTimeForApi(data?.fechaInicio),
});

const getDestAuditName = (data = {}) =>
    [data.name || data.nombre, data.destNumber || data.numero].filter(Boolean).join(' ') ||
    'Destacamento';

const registrarAuditoriaDestacamento = ({ accion, descripcion, data, response, usuario, severidad = 'informativa' }) => {
    registrarAuditoriaSilenciosa({
        modulo: 'destacamentos',
        accion,
        descripcion,
        severidad,
        entidad: {
            tipo: 'destacamento',
            id: response?.idDestacamento || response?.data?.idDestacamento || data?.idDestacamento || data?.id,
            nombre: getDestAuditName(data),
            ruta: '/dashboard/level/dest',
        },
        despues: data,
        realizadoPor: usuario,
        origen: 'niveles_organizacionales',
    });
};

export const createDestApi = async (data, { usuario } = {}) => {
    // Crear destacamentos: admin de seccion (su seccion), Coordinador/Sub-Director
    // Regional (secciones de su region) o admin pleno. Se valida contra la SECCION
    // DESTINO concreta: sin ella, un payload manipulado podia crear el
    // destacamento en una seccion ajena aunque el formulario tuviera el campo fijo.
    // Quien APRUEBA no se pide permiso a si mismo: al aplicar una propuesta ya
    // aprobada, la escritura la ejecuta la Oficina Nacional, cuyo alcance no es
    // el de la seccion donde va el destacamento.
    if (usuario && !isFullOrgManager(usuario) && !puedeAprobarCambiosDeOrganizacion(usuario)) {
        const sectionId = data?.sectionId ?? data?.idSeccion ?? data?.seccionId ?? null;
        const { regionId, ownSectionIds, ownRegionIds } = await resolveDestCreationScope(
            usuario,
            sectionId
        );

        assertScope(
            usuario,
            canCreateDestInSection(usuario, sectionId, { regionId, ownSectionIds, ownRegionIds }),
            'Solo puedes crear destacamentos dentro de tu sección o región.'
        );
    }

    const payload = buildDestPayload(data);

    // UN CARGO DE SECCION PROPONE, NO CREA. Puede dar de alta destacamentos en
    // su seccion —es la suya y sabe que hace falta—, pero lo suyo entra como
    // SUGERENCIA a la Oficina Nacional: un destacamento nuevo cambia el mapa de
    // la organizacion, y una sugerencia no se aplica sola. Quien si puede
    // —Administrador Global y Oficina Nacional— sigue creandolo en el momento.
    if (soloSugiereAltasDeDestacamento(usuario)) {
        const resultado = await proponerCambio({
            ambito: AMBITOS_CAMBIO.destacamento,
            entidad: {
                // Todavia no tiene id: lo tendra cuando se apruebe y se cree.
                tipo: 'destacamento',
                id: null,
                nombre: getDestAuditName(data),
                ruta: '/dashboard/level/dest',
            },
            cambios: [
                {
                    campo: 'nombre',
                    etiqueta: 'Destacamento nuevo',
                    antes: null,
                    despues: getDestAuditName(data),
                },
                {
                    campo: 'idSeccion',
                    etiqueta: 'Sección',
                    antes: null,
                    despues: data?.sectionId ?? data?.idSeccion ?? data?.seccionId ?? null,
                },
            ],
            usuario,
            esSugerencia: true,
            descripcion: `Se sugirió crear el destacamento ${getDestAuditName(data)}.`,
            payload: data,
            aplicar: () => createDestApi(data),
        });

        return { pendienteDeAprobacion: true, idSolicitud: resultado.idSolicitud };
    }

    const res = await fetch('/api/dest/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();


    if (!res.ok) {
        throw new Error(text || `Error creando destacamento (${res.status})`);
    }

    if (!text) {
        registrarAuditoriaDestacamento({
            accion: 'destacamento_creado',
            descripcion: `Se creó el destacamento ${getDestAuditName(data)}.`,
            data,
            response: {},
            usuario,
        });
        return {};
    }

    try {
        const response = JSON.parse(text);
        registrarAuditoriaDestacamento({
            accion: 'destacamento_creado',
            descripcion: `Se creó el destacamento ${getDestAuditName(data)}.`,
            data,
            response,
            usuario,
        });
        return response;
    } catch {
        registrarAuditoriaDestacamento({
            accion: 'destacamento_creado',
            descripcion: `Se creó el destacamento ${getDestAuditName(data)}.`,
            data,
            response: {},
            usuario,
        });
        return { raw: text };
    }
};

// Escritura real contra el backend. Se aisla aqui porque no se llama nunca a
// pelo: entra por la puerta de cambios, que decide si se ejecuta ahora o si
// espera a que la Oficina Nacional la apruebe.
const escribirDestacamento = async (payload) => {
    const res = await fetch('/api/dest/put', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const texto = await res.text();

    if (!res.ok) {
        throw new Error(texto || `Error actualizando destacamento (${res.status})`);
    }

    return texto;
};

export const updateDestApi = async (data, { usuario, antes = null } = {}) => {
    const payload = buildDestPayload(data);
    const cambios = compararParaHistorial(antes, data);

    // Modificar un destacamento lo aprueba la Oficina Nacional. Mientras no lo
    // haga, el cambio NO se escribe: queda como propuesta.
    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.destacamento,
        entidad: {
            tipo: 'destacamento',
            id: data?.id ?? data?.idDestacamento ?? null,
            nombre: getDestAuditName(data),
            ruta: '/dashboard/level/dest',
        },
        cambios,
        usuario,
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload: data,
        aplicar: () => escribirDestacamento(payload),
    });

    if (resultado.estado === ESTADOS_CAMBIO.pendiente) {
        // Queda pendiente: la puerta de cambios ya avisa a la Oficina Nacional y
        // al Administrador Global de que hay algo que aprobar, asi que un segundo
        // aviso aqui seria el mismo mensaje dos veces.
        return {
            pendienteDeAprobacion: true,
            idSolicitud: resultado.idSolicitud,
        };
    }

    // Aplicado. Que el aviso falle no puede tumbar un guardado que ya se
    // escribio, asi que va por detras y sin await.
    notificarDestacamentoActualizado({
        destacamento: {
            id: data?.id ?? data?.idDestacamento ?? null,
            nombre: getDestAuditName(data),
        },
        cambios,
        usuario,
    }).catch((error) => {
        console.warn('[destacamentos] no se pudo avisar del cambio', error);
    });

    // La puerta ya dejo constancia en Historial; no hace falta un segundo
    // registro aqui.
    return { pendienteDeAprobacion: false };
};

export const deleteDestApi = async (id, { usuario, antes = null } = {}) => {
    // Eliminar destacamentos queda reservado a los administradores plenos.
    assertScope(
        usuario,
        isFullOrgManager(usuario),
        'No tienes permiso para eliminar destacamentos.'
    );

    const res = await fetch(`/api/dest?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    const text = await res.text();

    if (!res.ok) {
        // El cuerpo viene en JSON: se saca el mensaje en vez de soltarle al
        // usuario las llaves y las comillas por pantalla.
        let mensaje = '';

        try {
            const cuerpo = text ? JSON.parse(text) : null;
            mensaje = cuerpo?.error || cuerpo?.message || cuerpo?.Message || '';
        } catch {
            mensaje = text;
        }

        // 409 no es un fallo: es la respuesta prevista cuando el destacamento aun
        // tiene miembros. Se DEVUELVE en vez de lanzarse, porque una excepcion
        // acaba en la consola y en la superposicion de errores de Next como si
        // algo se hubiera roto, y aqui no se ha roto nada: falta un paso previo.
        if (res.status === 409) {
            return { noSePudo: true, motivo: mensaje };
        }

        throw new Error(mensaje || `Error eliminando destacamento (${res.status})`);
    }

    const auditPayload = {
        modulo: 'destacamentos',
        accion: 'destacamento_eliminado',
        descripcion: `Se eliminó el destacamento ${getDestAuditName(antes)}.`,
        severidad: 'importante',
        entidad: {
            tipo: 'destacamento',
            id,
            nombre: getDestAuditName(antes),
            ruta: '/dashboard/level/dest',
        },
        antes,
        realizadoPor: usuario,
        origen: 'niveles_organizacionales',
    };

    registrarAuditoriaSilenciosa(auditPayload);

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};

// ----------------------------------------------------------------------
// Foto del destacamento.
//
// El Coordinador de Destacamento y su Asistente pueden SUGERIRLA: la imagen ya
// esta subida a una carpeta de propuesta, pero la foto oficial no cambia hasta
// que la Oficina Nacional lo aprueba. Quien puede aplicar directo se salta la
// espera, como en el resto de la ficha.
// ----------------------------------------------------------------------

export const proponerFotoDestacamento = async ({
    destacamento = {},
    foto = {},
    urlAntes = '',
    usuario = {},
} = {}) => {
    const idDestacamento = destacamento?.id ?? destacamento?.idDestacamento ?? null;
    const payload = {
        idDestacamento,
        rutaArchivo: foto?.rutaArchivo || '',
        urlFoto: foto?.urlFoto || '',
        subidoPor: usuario?.uid || usuario?.id || '',
    };

    const resultado = await proponerCambio({
        ambito: AMBITOS_CAMBIO.fotoDestacamento,
        entidad: {
            tipo: 'destacamento',
            id: idDestacamento,
            nombre: destacamento?.nombre || getDestAuditName(destacamento),
            ruta: `/dashboard/level/dest/${idDestacamento ?? ''}/edit`,
        },
        cambios: [
            {
                campo: 'avatarUrl',
                etiqueta: 'Foto del destacamento',
                antes: urlAntes || null,
                despues: foto?.urlFoto || null,
            },
        ],
        usuario,
        aplicarDirecto: puedeAprobarCambiosDeOrganizacion(usuario),
        payload,
        aplicar: () => aplicarFotoDestacamento(payload),
    });

    const pendienteDeAprobacion = resultado.estado === ESTADOS_CAMBIO.pendiente;

    // El aviso lleva las dos imagenes; que falle no deshace lo ya registrado.
    notificarFotoEntidadPropuesta({
        tipoEntidad: 'destacamento',
        entidad: { id: idDestacamento, nombre: destacamento?.nombre || '' },
        urlAntes,
        urlDespues: foto?.urlFoto || '',
        pendiente: pendienteDeAprobacion,
        usuario,
    }).catch((error) => {
        console.warn('[destacamentos] no se pudo avisar de la foto', error);
    });

    return {
        pendienteDeAprobacion,
        idSolicitud: resultado.idSolicitud || null,
    };
};

// Al aprobarla, la propuesta pasa a ser la foto principal. Se apunta al archivo
// que ya se subio: no se vuelve a subir nada.
export const aplicarFotoDestacamento = async (payload = {}) =>
    registrarFotoEntidadSubida({
        tipoEntidad: 'destacamento',
        idEntidad: payload?.idDestacamento,
        tipoFoto: 'perfil',
        rutaArchivo: payload?.rutaArchivo || '',
        urlFoto: payload?.urlFoto || '',
        subidoPor: payload?.subidoPor || '',
    });
