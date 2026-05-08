import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  writeBatch,
  collection,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

export const COLECCION_INFORMACION_MEDICA_BASICA = 'informacion_medica_basica_miembros';
export const COLECCION_MEDICAMENTOS_MIEMBROS = 'medicamentos_miembros';
export const COLECCION_ALERGIAS_MIEMBROS = 'alergias_miembros';
export const COLECCION_CONDICIONES_MEDICAS_MIEMBROS = 'condiciones_medicas_miembros';

const normalizeIdMiembros = (idMiembros) => {
  const numericId = Number(idMiembros);

  return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
};

const getDocumentoMiembroId = (idMiembros) => String(idMiembros);

const removeUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (item !== undefined) {
        acc[key] = removeUndefined(item);
      }

      return acc;
    }, {});
  }

  return value;
};

const getAuditFields = (usuario = {}) => ({
  actualizadoPorUid: usuario.uid || '',
  actualizadoPorNombre: usuario.displayName || usuario.email || '',
});

const getCreateAuditFields = (usuario = {}) => ({
  creadoPorUid: usuario.uid || '',
  creadoPorNombre: usuario.displayName || usuario.email || '',
});

const yesNoToSpanish = (value, unknownValue = 'desconocido') => {
  if (value === 'yes') return 'si';
  if (value === 'no') return 'no';

  return unknownValue;
};

const parseOptionalNumber = (value) => {
  const normalizedValue = String(value ?? '').replace(',', '.').trim();
  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : '';
};

const spanishToYesNo = (value, unknownValue = 'unknown') => {
  if (value === 'si' || value === true) return 'yes';
  if (value === 'no' || value === false) return 'no';

  return unknownValue;
};

const getBasePayload = async ({ coleccion, idMiembros, codigoMiembro, usuario }) => {
  const documentRef = doc(FIRESTORE, coleccion, getDocumentoMiembroId(idMiembros));
  const snapshot = await getDoc(documentRef);
  const now = new Date().toISOString();

  return {
    documentRef,
    fechaCampos: {
      ...(snapshot.exists() ? {} : { fechaCreacion: now, ...getCreateAuditFields(usuario) }),
      fechaActualizacion: now,
      ...getAuditFields(usuario),
    },
    identidadCampos: {
      idMiembros,
      codigoMiembro: codigoMiembro || '',
    },
  };
};

const mapInformacionBasicaToForm = (data = {}) => ({
  healthInsurance: spanishToYesNo(data.tieneSeguroMedico),
  insuranceName: data.nombreSeguro || '',
  policyNumber: data.numeroPoliza || '',
  bloodType: data.tipoSangre || 'unknown',
  heightApprox: data.estaturaAproximada || '',
  heightUnit: data.unidadEstatura || 'meters',
  weightApprox: data.pesoAproximado || '',
  weightUnit: data.unidadPeso || 'lbs',
  medicalContactName: data.nombreContactoMedico || '',
  medicalPrimaryPhone: data.telefonoPrincipalMedico || '',
  medicalSecondaryPhone: data.telefonoAlternoMedico || '',
  medicalRelationship: data.relacionContactoMedico || '',
  medicalNotes: data.notasMedicas || '',
});

const mapAlergiasToForm = (data = {}) => ({
  hasAllergies: spanishToYesNo(data.tieneAlergias, 'no'),
  drugAllergy: spanishToYesNo(data.alergiaMedicamentos, 'no'),
  drugAllergyDetails: data.detalleAlergiaMedicamentos || '',
  hasFoodAllergies: spanishToYesNo(data.tieneAlergiasAlimentarias, 'no'),
  foodAllergies: Array.isArray(data.alergiasAlimentarias) ? data.alergiasAlimentarias : [],
  foodAllergyOther: data.alergiaAlimentariaOtra || '',
  hasEnvironmentalAllergies: spanishToYesNo(data.tieneAlergiasAmbientales, 'no'),
  environmentalAllergies: Array.isArray(data.alergiasAmbientales)
    ? data.alergiasAmbientales
    : [],
  environmentalAllergyOther: data.alergiaAmbientalOtra || '',
  allergyReaction: data.tipoReaccion || 'mild',
});

const mapCondicionesToForm = (data = {}) => ({
  hasMedicalConditions: spanishToYesNo(data.tieneCondicionesMedicas, 'no'),
  medicalConditions: {
    asthma: Boolean(data.asma),
    diabetes: Boolean(data.diabetes),
    epilepsy: Boolean(data.epilepsia),
    hypertension: Boolean(data.hipertension),
    heart_problems: Boolean(data.problemasCorazon),
    respiratory_problems: Boolean(data.problemasRespiratorios),
    eating_disorders: Boolean(data.trastornosAlimenticios),
    other: Boolean(data.otraCondicion),
  },
  medicalConditionsOther: data.detalleOtraCondicion || '',
  specialCare: data.cuidadosEspeciales || '',
});

const mapMedicamentosToForm = (documents = []) => {
  const activeMedicationDocuments = documents.filter((item) => item.activo && item.tomaMedicamento);
  const statusDocument = documents.find((item) => item.tipoRegistro === 'estado_medicacion');

  if (!activeMedicationDocuments.length) {
    return {
      hasMedication: statusDocument?.tomaMedicamento ? 'yes' : 'no',
      medications: [
        {
          name: '',
          dose: '',
          schedule: [],
          reason: '',
          reasonOther: '',
        },
      ],
      selfAdministered: 'yes',
      administeredBy: '',
      useDuringActivities: 'no',
      activityTiming: '',
      hasRescueMedication: 'no',
      rescueMedicationName: '',
      rescueMedicationUsage: '',
      rescueMedicationStorage: '',
      medicationObservations: '',
    };
  }

  const firstMedication = activeMedicationDocuments[0] || {};

  return {
    hasMedication: 'yes',
    medications: activeMedicationDocuments.map((item) => ({
      name: item.nombreMedicamento || '',
      dose: item.dosis || '',
      schedule: Array.isArray(item.horarios) ? item.horarios : [],
      reason: item.razonUso || '',
      reasonOther: item.razonUsoOtro || '',
    })),
    selfAdministered: firstMedication.seAdministraSolo === false ? 'no' : 'yes',
    administeredBy: firstMedication.administradoPor || '',
    useDuringActivities: firstMedication.usaDuranteActividades ? 'yes' : 'no',
    activityTiming: firstMedication.momentoUsoActividad || '',
    hasRescueMedication: firstMedication.esMedicamentoRescate ? 'yes' : 'no',
    rescueMedicationName: firstMedication.nombreMedicamentoRescate || '',
    rescueMedicationUsage: firstMedication.instruccionesMedicamentoRescate || '',
    rescueMedicationStorage: firstMedication.lugarGuardadoMedicamentoRescate || '',
    medicationObservations: firstMedication.observacionesMedicamento || '',
  };
};

export const obtenerSaludMiembro = async (idMiembros) => {
  const normalizedId = normalizeIdMiembros(idMiembros);

  if (!isFirebaseConfigured || !FIRESTORE || !normalizedId) return {};

  const [
    informacionBasicaSnapshot,
    alergiasSnapshot,
    condicionesSnapshot,
    medicamentosSnapshot,
  ] = await Promise.all([
    getDoc(
      doc(
        FIRESTORE,
        COLECCION_INFORMACION_MEDICA_BASICA,
        getDocumentoMiembroId(normalizedId)
      )
    ),
    getDoc(doc(FIRESTORE, COLECCION_ALERGIAS_MIEMBROS, getDocumentoMiembroId(normalizedId))),
    getDoc(
      doc(FIRESTORE, COLECCION_CONDICIONES_MEDICAS_MIEMBROS, getDocumentoMiembroId(normalizedId))
    ),
    getDocs(
      query(
        collection(FIRESTORE, COLECCION_MEDICAMENTOS_MIEMBROS),
        where('idMiembros', '==', normalizedId)
      )
    ),
  ]);

  return {
    ...(informacionBasicaSnapshot.exists()
      ? mapInformacionBasicaToForm(informacionBasicaSnapshot.data())
      : {}),
    ...(alergiasSnapshot.exists() ? mapAlergiasToForm(alergiasSnapshot.data()) : {}),
    ...(condicionesSnapshot.exists() ? mapCondicionesToForm(condicionesSnapshot.data()) : {}),
    ...mapMedicamentosToForm(medicamentosSnapshot.docs.map((item) => item.data())),
  };
};

export const guardarInformacionMedicaBasicaMiembro = async ({
  idMiembros,
  codigoMiembro,
  data,
  usuario,
}) => {
  const base = await getBasePayload({
    coleccion: COLECCION_INFORMACION_MEDICA_BASICA,
    idMiembros,
    codigoMiembro,
    usuario,
  });

  const payload = removeUndefined({
    ...base.identidadCampos,
    tieneSeguroMedico: yesNoToSpanish(data.healthInsurance),
    nombreSeguro: data.insuranceName || '',
    numeroPoliza: data.policyNumber || '',
    tipoSangre: data.bloodType || 'unknown',
    estaturaAproximada: parseOptionalNumber(data.heightApprox),
    unidadEstatura: data.heightUnit || 'meters',
    pesoAproximado: parseOptionalNumber(data.weightApprox),
    unidadPeso: data.weightUnit || 'lbs',
    nombreContactoMedico: data.medicalContactName || '',
    telefonoPrincipalMedico: data.medicalPrimaryPhone || '',
    telefonoAlternoMedico: data.medicalSecondaryPhone || '',
    relacionContactoMedico: data.medicalRelationship || '',
    notasMedicas: data.medicalNotes || '',
    ...base.fechaCampos,
  });

  await setDoc(base.documentRef, payload, { merge: true });

  return payload;
};

export const guardarAlergiasMiembro = async ({ idMiembros, codigoMiembro, data, usuario }) => {
  const base = await getBasePayload({
    coleccion: COLECCION_ALERGIAS_MIEMBROS,
    idMiembros,
    codigoMiembro,
    usuario,
  });

  const payload = removeUndefined({
    ...base.identidadCampos,
    tieneAlergias: data.hasAllergies === 'yes',
    alergiaMedicamentos: data.drugAllergy === 'yes',
    detalleAlergiaMedicamentos: data.drugAllergyDetails || '',
    tieneAlergiasAlimentarias: data.hasFoodAllergies === 'yes',
    alergiasAlimentarias: Array.isArray(data.foodAllergies) ? data.foodAllergies : [],
    alergiaAlimentariaOtra: data.foodAllergyOther || '',
    tieneAlergiasAmbientales: data.hasEnvironmentalAllergies === 'yes',
    alergiasAmbientales: Array.isArray(data.environmentalAllergies)
      ? data.environmentalAllergies
      : [],
    alergiaAmbientalOtra: data.environmentalAllergyOther || '',
    tipoReaccion: data.allergyReaction || 'mild',
    ...base.fechaCampos,
  });

  await setDoc(base.documentRef, payload, { merge: true });

  return payload;
};

export const guardarCondicionesMedicasMiembro = async ({
  idMiembros,
  codigoMiembro,
  data,
  usuario,
}) => {
  const base = await getBasePayload({
    coleccion: COLECCION_CONDICIONES_MEDICAS_MIEMBROS,
    idMiembros,
    codigoMiembro,
    usuario,
  });

  const condiciones = data.medicalConditions || {};
  const payload = removeUndefined({
    ...base.identidadCampos,
    tieneCondicionesMedicas: data.hasMedicalConditions === 'yes',
    asma: Boolean(condiciones.asthma),
    diabetes: Boolean(condiciones.diabetes),
    epilepsia: Boolean(condiciones.epilepsy),
    hipertension: Boolean(condiciones.hypertension),
    problemasCorazon: Boolean(condiciones.heart_problems),
    problemasRespiratorios: Boolean(condiciones.respiratory_problems),
    trastornosAlimenticios: Boolean(condiciones.eating_disorders),
    otraCondicion: Boolean(condiciones.other),
    detalleOtraCondicion: data.medicalConditionsOther || '',
    cuidadosEspeciales: data.specialCare || '',
    ...base.fechaCampos,
  });

  await setDoc(base.documentRef, payload, { merge: true });

  return payload;
};

export const guardarMedicamentosMiembro = async ({ idMiembros, codigoMiembro, data, usuario }) => {
  const existingSnapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_MEDICAMENTOS_MIEMBROS),
      where('idMiembros', '==', idMiembros)
    )
  );
  const batch = writeBatch(FIRESTORE);
  const now = new Date().toISOString();

  existingSnapshot.docs.forEach((item) => batch.delete(item.ref));

  if (data.hasMedication !== 'yes') {
    const statusRef = doc(
      FIRESTORE,
      COLECCION_MEDICAMENTOS_MIEMBROS,
      `${idMiembros}_sin_medicacion`
    );

    batch.set(statusRef, removeUndefined({
      idMedicamento: `${idMiembros}_sin_medicacion`,
      idMiembros,
      codigoMiembro: codigoMiembro || '',
      tipoRegistro: 'estado_medicacion',
      tomaMedicamento: false,
      activo: false,
      fechaCreacion: now,
      fechaActualizacion: now,
      ...getCreateAuditFields(usuario),
      ...getAuditFields(usuario),
    }));

    await batch.commit();

    return [];
  }

  const medications = Array.isArray(data.medications) ? data.medications : [];
  const validMedications = medications
    .filter((medicamento) => String(medicamento?.name || '').trim())
    .slice(0, 5);

  if (!validMedications.length) {
    const statusRef = doc(
      FIRESTORE,
      COLECCION_MEDICAMENTOS_MIEMBROS,
      `${idMiembros}_medicacion_sin_detalle`
    );

    batch.set(statusRef, removeUndefined({
      idMedicamento: `${idMiembros}_medicacion_sin_detalle`,
      idMiembros,
      codigoMiembro: codigoMiembro || '',
      tipoRegistro: 'estado_medicacion',
      tomaMedicamento: true,
      activo: false,
      fechaCreacion: now,
      fechaActualizacion: now,
      ...getCreateAuditFields(usuario),
      ...getAuditFields(usuario),
    }));

    await batch.commit();

    return [];
  }

  validMedications
    .forEach((medicamento, index) => {
      const idMedicamento = `${idMiembros}_${index + 1}`;
      const medicationRef = doc(FIRESTORE, COLECCION_MEDICAMENTOS_MIEMBROS, idMedicamento);

      batch.set(medicationRef, removeUndefined({
        idMedicamento,
        idMiembros,
        codigoMiembro: codigoMiembro || '',
        tipoRegistro: 'medicamento',
        tomaMedicamento: true,
        nombreMedicamento: medicamento.name || '',
        dosis: medicamento.dose || '',
        horarios: Array.isArray(medicamento.schedule) ? medicamento.schedule : [],
        razonUso: medicamento.reason || '',
        razonUsoOtro: medicamento.reasonOther || '',
        seAdministraSolo: data.selfAdministered !== 'no',
        administradoPor: data.administeredBy || '',
        usaDuranteActividades: data.useDuringActivities === 'yes',
        momentoUsoActividad: data.activityTiming || '',
        esMedicamentoRescate: data.hasRescueMedication === 'yes',
        nombreMedicamentoRescate: data.rescueMedicationName || '',
        instruccionesMedicamentoRescate: data.rescueMedicationUsage || '',
        lugarGuardadoMedicamentoRescate: data.rescueMedicationStorage || '',
        observacionesMedicamento: data.medicationObservations || '',
        activo: true,
        fechaCreacion: now,
        fechaActualizacion: now,
        ...getCreateAuditFields(usuario),
        ...getAuditFields(usuario),
      }));
    });

  await batch.commit();

  return validMedications;
};

export const guardarSaludMiembro = async ({ idMiembros, codigoMiembro, data, usuario }) => {
  const normalizedId = normalizeIdMiembros(idMiembros);

  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para guardar salud.');
  }

  if (!normalizedId) {
    throw new Error('La informacion de salud necesita idMiembros valido.');
  }

  await Promise.all([
    guardarInformacionMedicaBasicaMiembro({
      idMiembros: normalizedId,
      codigoMiembro,
      data,
      usuario,
    }),
    guardarAlergiasMiembro({ idMiembros: normalizedId, codigoMiembro, data, usuario }),
    guardarCondicionesMedicasMiembro({
      idMiembros: normalizedId,
      codigoMiembro,
      data,
      usuario,
    }),
    guardarMedicamentosMiembro({ idMiembros: normalizedId, codigoMiembro, data, usuario }),
  ]);
};
