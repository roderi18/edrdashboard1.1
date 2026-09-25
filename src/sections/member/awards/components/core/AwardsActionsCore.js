import { getMemberById } from 'src/services/member-service';
import { guardarCertificadoAscensoManual } from 'src/services/certificate-service';
import { crearSolicitudCambioEstadoAscenso } from 'src/services/award-status-change-request-service';
import {
  avisarCambioEstadoEnLote,
  guardarProgresoAscensoMiembro,
} from 'src/services/member-awards-service';
import {
  getAwardsProgressCache,
  setAwardsProgressCache,
  notifyAwardsProgressChanged,
} from 'src/services/awards-progress-cache';

export function createAwardsActions({
  system, // 'academia' | 'sistemaAscenso'
  memberId,
  context, // { sectionId?, parentId, rowId }
  metadata = {},
  user,
  onRequireStatusChangeApproval,
}) {
  if (
    !system ||
    !memberId ||
    !context?.rowId ||
    (system === 'sistemaAscenso' && !context?.sectionId)
  ) {
    return {
      setStatus: () => {},
      setCompletedDate: () => {},
      uploadCertificate: () => {},
      deleteCertificate: () => {},
      updateTimesCompleted: () => {},
      requestStatusChange: () => Promise.resolve(null),
    };
  }

  const readStatus = () => getAwardsProgressCache(memberId).status || {};

  const readData = () => getAwardsProgressCache(memberId).data || {};

  const saveAll = (status, data) => {
    setAwardsProgressCache(memberId, { status, data });
    notifyAwardsProgressChanged(memberId);
  };

  const ensurePath = (obj, path) => {
    let current = obj;

    path.forEach((key) => {
      current[key] ??= {};
      current = current[key];
    });

    return current;
  };

  const getNode = (data) => {
    if (system === 'academia') {
      return data.academia?.[context.parentId]?.[context.rowId] || {};
    }

    return data.sistemaAscenso?.[context.sectionId]?.[context.parentId]?.[context.rowId] || {};
  };

  const setNode = (data, value) => {
    if (system === 'academia') {
      ensurePath(data, ['academia', context.parentId])[context.rowId] = value;
      return;
    }

    ensurePath(data, ['sistemaAscenso', context.sectionId, context.parentId])[context.rowId] =
      value;
  };

  const setStatusValue = (status, value) => {
    if (system === 'academia') {
      ensurePath(status, ['academia', context.parentId])[context.rowId] = value;
      return;
    }

    ensurePath(status, ['sistemaAscenso', context.sectionId, context.parentId])[context.rowId] =
      value;
  };

  const getVinculo = () => ({
    id: `${system}_${context.sectionId || 'academia'}_${context.parentId}_${context.rowId}`,
    idItemAscenso: context.rowId,
    nombreItemAscenso:
      metadata.nombreItemAscenso || metadata.nombre || context.rowName || context.rowId,
    sistema: system,
    idDivision: context.sectionId || metadata.idDivision || '',
    nombreDivision: metadata.nombreDivision || '',
    idGrupo: context.parentId,
    nombreGrupo: metadata.nombreGrupo || context.parentName || context.parentId,
    activo: true,
  });

  // `certificado`: el del premio, `undefined` para dejar el que haya en Firestore,
  // o `null` SOLO cuando se pide borrarlo (quitar el completado, eliminar el
  // certificado). Un premio leído sin certificado vale `null` en memoria y, si
  // se mandara tal cual, borraría uno que otra persona hubiera subido entretanto.
  //
  // Devuelve si llegó a Firestore. Antes el fallo se tragaba en silencio: la
  // pantalla enseñaba el premio completado aunque la base de datos no lo tuviera.
  // Quien no mira el resultado sigue igual (no lanza nunca).
  const persistProgress = (overrides = {}) =>
    guardarProgresoAscensoMiembro({
      idMiembro: memberId,
      vinculo: getVinculo(),
      user,
      ...overrides,
    })
      .then(() => true)
      .catch((error) => {
        console.error('[ascenso] no se pudo guardar el progreso', error);
        return false;
      });

  const setStatus = (nextStatus, { skipApproval = false, borrarCertificado = false } = {}) => {
    const now = new Date().toISOString();
    const status = readStatus();
    const data = readData();
    const existing = getNode(data);

    if (
      !skipApproval &&
      system === 'sistemaAscenso' &&
      existing.status === 'completado' &&
      nextStatus !== 'completado'
    ) {
      onRequireStatusChangeApproval?.({
        nextStatus,
        nextTimesCompleted: 0,
        hasCertificate: Boolean(existing.certificate),
      });
      // Pendiente de aprobación: nada se guardó todavía.
      return Promise.resolve(null);
    }
    const nextNode = {
      ...existing,
      status: nextStatus,
      updatedAt: now,
      ...(nextStatus === 'completado' && {
        completedDate: existing.completedDate || now,
        timesCompleted:
          system === 'sistemaAscenso' ? existing.timesCompleted || 1 : existing.timesCompleted,
      }),
      ...(nextStatus !== 'completado' && {
        completedDate: null,
        ...(system === 'sistemaAscenso' && { timesCompleted: 0 }),
      }),
    };

    setStatusValue(status, nextStatus);
    setNode(data, nextNode);
    saveAll(status, data);

    return persistProgress({
      estado: nextStatus,
      fechaCompletado: nextNode.completedDate,
      vecesCompletado: Number(nextNode.timesCompleted || (nextStatus === 'completado' ? 1 : 0)),
      certificado: borrarCertificado ? null : nextNode.certificate || undefined,
    });
  };

  const setCompletedDate = (isoDate) => {
    if (!isoDate) return;

    const status = readStatus();
    const data = readData();
    const now = new Date().toISOString();
    const existing = getNode(data);
    const nextNode = {
      ...existing,
      status: 'completado',
      completedDate: isoDate,
      timesCompleted:
        system === 'sistemaAscenso' ? existing.timesCompleted || 1 : existing.timesCompleted,
      updatedAt: now,
    };

    setStatusValue(status, 'completado');
    setNode(data, nextNode);
    saveAll(status, data);

    persistProgress({
      estado: 'completado',
      fechaCompletado: isoDate,
      vecesCompletado: Number(nextNode.timesCompleted || 1),
      certificado: nextNode.certificate || undefined,
    });
  };

  const mergeSavedCertificate = (savedCertificate) => {
    if (!savedCertificate) return;

    const data = readData();
    const status = readStatus();
    const existing = getNode(data);
    const nextNode = {
      ...existing,
      certificate: savedCertificate,
      status: 'completado',
      timesCompleted:
        system === 'sistemaAscenso' ? existing.timesCompleted || 1 : existing.timesCompleted,
      completedDate:
        existing.completedDate || savedCertificate.uploadedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setStatusValue(status, 'completado');
    setNode(data, nextNode);
    saveAll(status, data);
  };

  const uploadCertificate = (certificate) => {
    if (!certificate) return Promise.resolve(false);

    const now = new Date().toISOString();
    const status = readStatus();
    const data = readData();
    const existing = getNode(data);
    const localCertificate = {
      ...certificate,
      uploadedAt: certificate.uploadedAt || now,
    };
    const nextNode = {
      ...existing,
      status: 'completado',
      certificate: localCertificate,
      timesCompleted:
        system === 'sistemaAscenso' ? existing.timesCompleted || 1 : existing.timesCompleted,
      completedDate: existing.completedDate || localCertificate.uploadedAt,
      updatedAt: now,
    };

    const estadoAnterior = readStatus();
    const previoEstado =
      system === 'academia'
        ? estadoAnterior.academia?.[context.parentId]?.[context.rowId]
        : estadoAnterior.sistemaAscenso?.[context.sectionId]?.[context.parentId]?.[context.rowId];

    setStatusValue(status, 'completado');
    setNode(data, nextNode);
    saveAll(status, data);

    // Devuelve si llegó a Firebase. Antes el fallo solo iba a la consola y la
    // pantalla enseñaba el certificado (check verde) aunque no se hubiera
    // guardado: al recargar desaparecía. Ahora, si falla, se deshace en pantalla
    // y quien llama avisa.
    return guardarCertificadoAscensoManual({
      idMiembro: memberId,
      sistema: system,
      context,
      metadata,
      certificate: localCertificate,
      user,
    })
      .then((guardado) => {
        mergeSavedCertificate(guardado);
        return true;
      })
      .catch((error) => {
        console.error('[awards] no se pudo guardar el certificado en Firebase', error);
        const datos = readData();
        const estados = readStatus();
        setNode(datos, existing);
        setStatusValue(estados, previoEstado || existing.status || 'no_iniciado');
        saveAll(estados, datos);
        return false;
      });
  };

  const deleteCertificate = () => {
    const data = readData();
    const existing = getNode(data);

    if (!existing) return;

    const nextNode = {
      ...existing,
      certificate: null,
      updatedAt: new Date().toISOString(),
    };

    setNode(data, nextNode);
    saveAll(readStatus(), data);

    persistProgress({
      estado: nextNode.status || 'no_iniciado',
      fechaCompletado: nextNode.completedDate,
      vecesCompletado: Number(nextNode.timesCompleted || 0),
      certificado: null,
    });
  };

  const updateTimesCompleted = (value) => {
    if (system !== 'sistemaAscenso') return;

    const data = readData();
    const status = readStatus();
    const now = new Date().toISOString();
    const safe = Math.min(10, Math.max(0, value));
    const existing = getNode(data);

    if (existing.status === 'completado' && safe === 0) {
      onRequireStatusChangeApproval?.({
        nextStatus: 'no_iniciado',
        nextTimesCompleted: 0,
        hasCertificate: Boolean(existing.certificate),
      });
      return;
    }
    const nextStatus = safe > 0 ? 'completado' : 'no_iniciado';
    const nextNode = {
      ...existing,
      timesCompleted: safe,
      status: nextStatus,
      completedDate: safe > 0 ? existing.completedDate || now : null,
      updatedAt: now,
    };

    setNode(data, nextNode);
    setStatusValue(status, nextStatus);
    saveAll(status, data);

    persistProgress({
      estado: nextStatus,
      fechaCompletado: nextNode.completedDate,
      vecesCompletado: safe,
      certificado: nextNode.certificate || undefined,
    });
  };

  const requireCertificateDeletion = ({ hasCertificate, nextStatus, onConfirm }) => {
    if (!hasCertificate) {
      setStatus(nextStatus);
      return undefined;
    }

    // Un solo guardado (ver `applyStatusChange`), no dos que se pisen.
    return () => {
      const data = readData();
      setNode(data, { ...getNode(data), certificate: null });
      setStatus(nextStatus, { borrarCertificado: true });
      onConfirm?.();
    };
  };

  const requestStatusChange = ({ nextStatus, nextTimesCompleted = 0 } = {}) =>
    crearSolicitudCambioEstadoAscenso({
      memberId,
      context,
      metadata,
      nextStatus,
      nextTimesCompleted,
      user,
    });

  // Aplica el cambio de estado en el acto, sin solicitud de aprobacion. Lo usan
  // el Coordinador de Destacamento y su Asistente: ven el mismo aviso, pero
  // confirman y se aplica (no tienen a quien pedirle permiso).
  //
  // Con certificado, UN solo guardado: se quita en memoria y `setStatus` lo manda
  // (con `certificado: null`) junto al estado. Antes eran dos guardados del mismo
  // premio a la vez y el de "borrar certificado" (aún completado) podía llegar el
  // último y dejarlo completado en Firestore.
  const applyStatusChange = ({ nextStatus, removeCertificate = false } = {}) => {
    if (!nextStatus) return Promise.resolve(null);
    if (removeCertificate) {
      const data = readData();
      setNode(data, { ...getNode(data), certificate: null });
    }
    return setStatus(nextStatus, { skipApproval: true, borrarCertificado: removeCertificate });
  };

  return {
    setStatus,
    applyStatusChange,
    setCompletedDate,
    uploadCertificate,
    deleteCertificate,
    updateTimesCompleted,
    requireCertificateDeletion,
    requestStatusChange,
  };
}

// ----------------------------------------------------------------------
// CAMBIAR EL ESTADO DE VARIOS PREMIOS DEL SISTEMA DE ASCENSO DE UNA VEZ.
//
// Lo mismo que `setStatus` de cada uno (misma forma en memoria y en Firestore,
// mismo historial), pero en lote: todo se escribe en memoria de una sola vez y
// se avisa a la pantalla UNA vez —los checks cambian todos a la vez—, y
// Firestore se guarda en paralelo por detrás. Llamar a `setStatus` por cada
// premio repintaba la cuadrícula entera tantas veces como premios.
//   - 'completado': los que ya lo estaban no se tocan (ni su fecha ni sus veces).
//   - 'no_iniciado' (quitar el completado): solo los completados; se borran su
//     fecha, sus veces y su certificado, como `applyStatusChange` con
//     `removeCertificate`. Quien necesite aprobación NO llega aquí: pide la
//     solicitud (`requestStatusChange`).
// Devuelve `{ cambiados, fallidos }` cuando Firestore termina.
// ----------------------------------------------------------------------
export async function cambiarEstadoPremiosAscenso({ memberId, premios = [], nextStatus, user }) {
  const completar = nextStatus === 'completado';
  if (!memberId || !premios.length || !nextStatus) return { cambiados: 0, fallidos: 0 };

  const now = new Date().toISOString();
  const { status = {}, data = {} } = getAwardsProgressCache(memberId);
  const pendientes = [];

  premios.forEach(({ sectionId, parentId, rowId, metadata = {} }) => {
    if (!sectionId || !parentId || !rowId) return;
    const yaCompletado = status.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId] === 'completado';
    if (completar === yaCompletado) return;

    status.sistemaAscenso ??= {};
    status.sistemaAscenso[sectionId] ??= {};
    status.sistemaAscenso[sectionId][parentId] ??= {};
    data.sistemaAscenso ??= {};
    data.sistemaAscenso[sectionId] ??= {};
    data.sistemaAscenso[sectionId][parentId] ??= {};

    const existing = data.sistemaAscenso[sectionId][parentId][rowId] || {};
    const nextNode = completar
      ? {
          ...existing,
          status: 'completado',
          updatedAt: now,
          completedDate: existing.completedDate || now,
          timesCompleted: existing.timesCompleted || 1,
        }
      : {
          ...existing,
          status: nextStatus,
          updatedAt: now,
          completedDate: null,
          timesCompleted: 0,
          certificate: null,
        };

    status.sistemaAscenso[sectionId][parentId][rowId] = nextStatus;
    data.sistemaAscenso[sectionId][parentId][rowId] = nextNode;

    pendientes.push({ sectionId, parentId, rowId, metadata, nextNode });
  });

  if (!pendientes.length) return { cambiados: 0, fallidos: 0 };

  setAwardsProgressCache(memberId, { status, data });
  notifyAwardsProgressChanged(memberId);

  // El miembro, una sola vez para todo el lote (cada guardado lo buscaba en el
  // padrón y copiaba la lista entera). Ya con la pantalla al día.
  const miembro = (await getMemberById(memberId).catch(() => null)) || undefined;

  const resultados = await Promise.all(
    pendientes.map(({ sectionId, parentId, rowId, metadata, nextNode }) =>
      guardarProgresoAscensoMiembro({
        member: miembro,
        idMiembro: memberId,
        vinculo: {
          id: `sistemaAscenso_${sectionId}_${parentId}_${rowId}`,
          idItemAscenso: rowId,
          nombreItemAscenso: metadata.nombreItemAscenso || rowId,
          sistema: 'sistemaAscenso',
          idDivision: sectionId,
          nombreDivision: metadata.nombreDivision || '',
          idGrupo: parentId,
          nombreGrupo: metadata.nombreGrupo || parentId,
          activo: true,
        },
        estado: nextStatus,
        fechaCompletado: nextNode.completedDate,
        vecesCompletado: Number(nextNode.timesCompleted || 0),
        certificado: completar ? nextNode.certificate || undefined : null,
        user,
        avisar: false,
      })
        .then(() => true)
        .catch((error) => {
          console.error('[ascenso] no se pudo guardar el progreso', error);
          return false;
        })
    )
  );

  const fallidos = resultados.filter((ok) => !ok).length;

  // Un solo aviso a los coordinadores con todos los que se guardaron.
  const guardados = pendientes.filter((_, indice) => resultados[indice]);
  if (guardados.length) {
    avisarCambioEstadoEnLote({
      idMiembro: memberId,
      nombres: guardados.map(({ metadata, rowId }) => metadata.nombreItemAscenso || rowId),
      estadoAnterior: completar ? 'no_iniciado' : 'completado',
      estadoNuevo: nextStatus,
      idGrupo: guardados[0].parentId,
      user,
    });
  }

  return { cambiados: resultados.length - fallidos, fallidos };
}

/** Completar varios de una vez (ver `cambiarEstadoPremiosAscenso`). */
export async function completarPremiosAscenso({ memberId, premios, user }) {
  const { cambiados, fallidos } = await cambiarEstadoPremiosAscenso({
    memberId,
    premios,
    user,
    nextStatus: 'completado',
  });

  return { completados: cambiados, fallidos };
}
