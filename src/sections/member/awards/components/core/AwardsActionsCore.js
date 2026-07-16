import { guardarCertificadoAscensoManual } from 'src/services/certificate-service';
import { guardarProgresoAscensoMiembro } from 'src/services/member-awards-service';
import { crearSolicitudCambioEstadoAscenso } from 'src/services/award-status-change-request-service';
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

  const persistProgress = (overrides = {}) => {
    guardarProgresoAscensoMiembro({
      idMiembro: memberId,
      vinculo: getVinculo(),
      user,
      ...overrides,
    }).catch(() => null);
  };

  const setStatus = (nextStatus) => {
    const now = new Date().toISOString();
    const status = readStatus();
    const data = readData();
    const existing = getNode(data);

    if (
      system === 'sistemaAscenso' &&
      existing.status === 'completado' &&
      nextStatus !== 'completado'
    ) {
      onRequireStatusChangeApproval?.({
        nextStatus,
        nextTimesCompleted: 0,
        hasCertificate: Boolean(existing.certificate),
      });
      return;
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

    persistProgress({
      estado: nextStatus,
      fechaCompletado: nextNode.completedDate,
      vecesCompletado: Number(nextNode.timesCompleted || (nextStatus === 'completado' ? 1 : 0)),
      certificado: nextNode.certificate,
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
      certificado: nextNode.certificate,
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
    if (!certificate) return;

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

    setStatusValue(status, 'completado');
    setNode(data, nextNode);
    saveAll(status, data);

    guardarCertificadoAscensoManual({
      idMiembro: memberId,
      sistema: system,
      context,
      metadata,
      certificate: localCertificate,
      user,
    })
      .then(mergeSavedCertificate)
      .catch(() => null);
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
      certificado: nextNode.certificate,
    });
  };

  const requireCertificateDeletion = ({ hasCertificate, nextStatus, onConfirm }) => {
    if (!hasCertificate) {
      setStatus(nextStatus);
      return undefined;
    }

    return () => {
      deleteCertificate();
      setStatus(nextStatus);
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

  return {
    setStatus,
    setCompletedDate,
    uploadCertificate,
    deleteCertificate,
    updateTimesCompleted,
    requireCertificateDeletion,
    requestStatusChange,
  };
}
