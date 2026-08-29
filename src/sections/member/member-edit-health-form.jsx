'use client';

import { useSearchParams } from 'next/navigation';
// Hooks
import { useBoolean } from 'minimal-shared/hooks';
// React
import { useRef, useState, useEffect } from 'react';
// Validaciones / forms
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';

// MUI components
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import {
  canViewHealth,
  esMiembroDeSuAlcance,
  canApproveMemberChanges,
  canDeleteHealthDocuments,
  canUploadHealthDocuments,
  isPastorDestacamentoRole,
  isSupervisoryMemberViewer,
  isDestacamentoApprovalRole,
  isCoordinadorDestacamentoRole,
  canAuthorizeMinorHealthAccess,
} from 'src/utils/member-access';

import { crearNotificacionAdmin } from 'src/services/notification-service';
import { guardarSaludMiembro, obtenerSaludMiembro } from 'src/services/member-health-service';
import {
  notificarCoordinadoresCambioMiembro,
  notificarCoordinadoresActualizacionDirecta,
} from 'src/services/solicitudes-cambio-notificaciones-service';
import {
  getModuloSolicitud,
  ESTADOS_SOLICITUD_CAMBIO,
  MODULOS_SOLICITUD_CAMBIO,
  RESULTADO_SOLICITUD_LABEL,
  crearSolicitudCambioMiembro,
  obtenerSolicitudCambioPorId,
  clasificarResultadoSolicitud,
  resolverSolicitudCambioMiembro,
  obtenerSolicitudPendientePorMiembro,
} from 'src/services/solicitudes-cambio-miembro-service';
import {
  esMiembroMenorDeEdad,
  DURACIONES_ACCESO_SALUD,
  obtenerEstadoAccesoSalud,
  crearSolicitudAccesoSalud,
  resolverSolicitudAccesoSalud,
  TODAS_SECCIONES_ACCESO_SALUD,
  estaPermisoAccesoSaludVigente,
  obtenerSolicitudAccesoSaludPorId,
  consumirPermisoAccesoSaludUnaVez,
  formatearTiempoRestanteAccesoSalud,
} from 'src/services/member-health-access-service';

// Hook form components
import { Form } from 'src/components/hook-form';
import { toast } from 'src/components/snackbar';
// Table components
import { useTable, } from 'src/components/table';
// Custom components
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { MemberHealthSchema } from 'src/sections/member/health/schema';
import { HealthBasicSection } from 'src/sections/member/health/sections/health-basic-section';
import { HealthDocumentsSection } from 'src/sections/member/health/sections/health-documents-section';
import { HealthAllergiesSection } from 'src/sections/member/health/sections/health-allergies-section';
import { HealthMedicationSection } from 'src/sections/member/health/sections/health-medication-section';
import { HealthConditionsSection } from 'src/sections/member/health/sections/health-conditions-section';
// File manager
import { FileManagerCreateFolderDialog } from 'src/sections/file-manager/file-manager-create-folder-dialog';

import { useAuthContext } from 'src/auth/hooks';

import { MemberChangeResultDialog } from './member-change-result-dialog';
import { useMedicalDocuments } from './health/hooks/use-medical-documents';
import { MemberHealthChangeRequestDialog } from './member-health-change-request-dialog';
import {
  pickHealthValues,
  construirCambiosSalud,
} from './member-health-change-request-fields';
import {
  MemberHealthAccessReviewDialog,
  MemberHealthAccessRequestDialog,
} from './member-health-access-dialogs';

const DEFAULT_MEDICAL_CONDITIONS = {
    asthma: false,
    diabetes: false,
    epilepsy: false,
    hypertension: false,
    heart_problems: false,
    respiratory_problems: false,
    eating_disorders: false,
    surgery: false,
    other: false,
};

const EMPTY_HEALTH_SECTIONS = [];

export function MemberEditHealthForm({ currentMember, readOnly = false }) {
    const { user } = useAuthContext();
    const memberId = currentMember?.id;
    const router = useRouter();
    const searchParams = useSearchParams();

    // Cargos del destacamento que no son coordinadores (líder de grupo/asistente,
    // pastor, consejo, capellán): no guardan directo la Dispensa Médica, envían los
    // cambios a aprobación del Coordinador de Destacamento. Pueden subir documentos
    // pero no eliminarlos.
    const isApprovalUser = isDestacamentoApprovalRole(user);
    const isCoordinador = isCoordinadorDestacamentoRole(user);
    // Excepción del Pastor: aunque comparte el perfil del Coordinador, NO tiene
    // acceso a la sección de Documentos de la Dispensa Médica (se deshabilita/
    // enmascara con el mecanismo de secciones); puede solicitar acceso desde el
    // banner de costumbre.
    const isPastor = isPastorDestacamentoRole(user);
    const isMinor = esMiembroMenorDeEdad(currentMember);
    // Quien puede AUTORIZAR el acceso a la salud de menores no necesita pedirlo
    // (coordinadores y Administrador Global, según el catálogo de permisos).
    const puedeAutorizarAccesoMenores = canAuthorizeMinorHealthAccess(user);
    // Vista limitada de salud: sin `salud.ver` solo ve
    // los campos básicos permitidos; el resto (seguro, medicación, alergias,
    // condiciones y documentos) se muestra ENMASCARADO con asteriscos.
    // Fuera de su destacamento la Dispensa no se ve: ni las secciones ni los
    // datos. El permiso de salud vale sobre la gente que acompaña, no sobre
    // cualquiera de la organizacion.
    const fueraDeSuAlcance = !esMiembroDeSuAlcance(user, currentMember);
    const limitedHealth = fueraDeSuAlcance || !canViewHealth(user);
    const isSupervisoryViewerRole = isSupervisoryMemberViewer(user);
    // Los cargos del Consejo Nacional ven las secciones médicas normalmente,
    // pero los datos del seguro de un menor permanecen enmascarados hasta
    // obtener autorización.
    const requiresMaskedInsuranceAccess = isMinor && isSupervisoryViewerRole;
    // Los cargos del destacamento que no son coordinadores —Pastor, Consejo,
    // Capellan y los dos Lideres de Grupo— ven y EDITAN la Dispensa Medica de sus
    // miembros, menores incluidos, sin pedir autorizacion previa: el control es
    // que sus cambios van a APROBACION de los Coordinadores (`mustRequestApproval`).
    // Al Pastor le sigue quedando fuera la seccion de Documentos.
    // Los cargos del destacamento que envian sus cambios a aprobacion —Pastor,
    // Consejo, Capellan y los dos Lideres de Grupo— ven y editan la Dispensa de
    // sus menores sin pedir acceso temporal: el control es que lo que tocan lo
    // aprueba el Coordinador. Antes el Consejo y el Capellan si tenian que
    // pedirlo, y hacian el mismo trabajo que los otros tres.
    const requiresTemporaryAccess =
        isMinor && !puedeAutorizarAccesoMenores && !isSupervisoryViewerRole && !isApprovalUser;
    // Cargos de supervisión (sección, región y Consejo Nacional): la Dispensa
    // Médica les queda BLOQUEADA por completo —secciones sin desplegar y campos
    // deshabilitados— hasta que un Coordinador de Destacamento les conceda acceso
    // desde el aviso de la ficha. No depende de que el miembro sea menor.
    const supervisoryNeedsHealthAccess = isSupervisoryViewerRole;
    const shouldCheckAccess =
        requiresTemporaryAccess || requiresMaskedInsuranceAccess || supervisoryNeedsHealthAccess;
    const mustRequestApproval = isApprovalUser || requiresTemporaryAccess;
    const puedeEliminarDocumentos = canDeleteHealthDocuments(user);
    const puedeSubirDocumentos = canUploadHealthDocuments(user);
    const puedeAprobarCambios = canApproveMemberChanges(user);

    const solicitudIdFromUrl = searchParams?.get('solicitud') || '';
    const resultadoIdFromUrl = searchParams?.get('resultado') || '';
    const accessRequestIdFromUrl = searchParams?.get('accesoSolicitud') || '';
    const accessResultIdFromUrl = searchParams?.get('accesoResultado') || '';

    // Snapshot de los valores de salud con los que se cargo el formulario (el
    // "antes" para calcular el diff de la solicitud).
    const valoresAnterioresRef = useRef({});

    const [sendingApproval, setSendingApproval] = useState(false);
    const [leaderPendingRequest, setLeaderPendingRequest] = useState(null);
    const [changeRequest, setChangeRequest] = useState(null);
    const [changeRequestOpen, setChangeRequestOpen] = useState(false);
    const [resolvingChangeRequest, setResolvingChangeRequest] = useState(false);
    const [changeResult, setChangeResult] = useState(null);
    const [changeResultOpen, setChangeResultOpen] = useState(false);
    const [accessLoading, setAccessLoading] = useState(shouldCheckAccess);
    const [accessPermission, setAccessPermission] = useState(null);
    const [pendingAccessRequest, setPendingAccessRequest] = useState(null);
    const [accessRequestOpen, setAccessRequestOpen] = useState(false);
    const [sendingAccessRequest, setSendingAccessRequest] = useState(false);
    const [accessReview, setAccessReview] = useState(null);
    const [accessReviewOpen, setAccessReviewOpen] = useState(false);
    const [resolvingAccess, setResolvingAccess] = useState(false);
    const [accessResult, setAccessResult] = useState(null);
    const [accessNow, setAccessNow] = useState(Date.now());

    const maskHealthInsurance =
        limitedHealth || (requiresMaskedInsuranceAccess && !accessPermission);
    const baseHealthSections = fueraDeSuAlcance
        ? EMPTY_HEALTH_SECTIONS
        : requiresTemporaryAccess || supervisoryNeedsHealthAccess
          ? accessPermission?.secciones || EMPTY_HEALTH_SECTIONS
          : TODAS_SECCIONES_ACCESO_SALUD;
    // El Pastor no accede a la sección de Documentos (se deshabilita/enmascara con
    // el mismo mecanismo de secciones); usa el banner de costumbre para solicitar
    // acceso al Coordinador de Destacamento.
    const allowedHealthSections = isPastor
        ? baseHealthSections.filter((section) => section !== 'documentos')
        : baseHealthSections;
    const canAccessSection = (section) => allowedHealthSections.includes(section);

    const normalizedMember = {
        ...currentMember,
        healthInsurance: currentMember?.healthInsurance ?? 'unknown',
    };

    const defaultValues = {
        avatarUrl: currentMember?.avatarUrl || null,
        isVerified: true,
        destName: '',
        regionalName: '',
        church: '',
        memberAddress: '',
        documents: null,

        healthInsurance: 'unknown',
        insuranceName: '',
        bloodType: 'unknown',

        heightApprox: '',
        heightUnit: 'meters',

        weightApprox: '',
        weightUnit: 'lbs',

        medicalRelationship: '',
        hasMedication: 'no',
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

        //alergias
        hasAllergies: 'no',
        drugAllergy: 'no',
        drugAllergyDetails: '',
        hasFoodAllergies: 'no',
        hasEnvironmentalAllergies: 'no',
        foodAllergies: [],
        environmentalAllergies: [],

        allergyReaction: 'mild',

        // condiciones médicas
        hasMedicalConditions: 'no',

        medicalConditions: { ...DEFAULT_MEDICAL_CONDITIONS },

        medicalConditionsOther: '',
        surgeryDetails: '',
        specialCare: '',

    };

    const methods = useForm({
        mode: 'onSubmit',
        resolver: zodResolver(MemberHealthSchema),
        defaultValues: {
            ...defaultValues,
            ...normalizedMember,
            bloodType: 'unknown',
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: methods.control,
        name: 'medications',
    });

    const {
        watch,
        reset,
        setValue,
        setError,
        getValues,
        clearErrors,
        handleSubmit,
        formState: { isSubmitting },
    } = methods;

    const healthInsurance = watch('healthInsurance');

    useEffect(() => {
        if (healthInsurance !== 'yes') {
            setValue('insuranceName', '');
            setValue('policyNumber', '');
        }
    }, [healthInsurance, setValue]);

    useEffect(() => {
        if (!accessPermission || accessPermission.duracion === DURACIONES_ACCESO_SALUD.unaVez) {
            return undefined;
        }

        const interval = window.setInterval(() => setAccessNow(Date.now()), 60 * 1000);
        return () => window.clearInterval(interval);
    }, [accessPermission]);

    useEffect(() => {
        if (
            accessPermission &&
            accessPermission.duracion !== DURACIONES_ACCESO_SALUD.unaVez &&
            !estaPermisoAccesoSaludVigente(accessPermission, accessNow)
        ) {
            setAccessPermission(null);
        }
    }, [accessNow, accessPermission]);

    useEffect(() => {
        let active = true;

        const loadAccess = async () => {
            if (!shouldCheckAccess) {
                setAccessPermission(null);
                setPendingAccessRequest(null);
                setAccessLoading(false);
                return;
            }

            setAccessLoading(true);
            try {
                const state = await obtenerEstadoAccesoSalud({ member: currentMember, usuario: user });
                if (!active) return;

                if (state.permiso?.duracion === DURACIONES_ACCESO_SALUD.unaVez) {
                    const consumed = await consumirPermisoAccesoSaludUnaVez(state.permiso.id, user);
                    if (!active) return;
                    setAccessPermission(consumed ? state.permiso : null);
                } else {
                    setAccessPermission(state.permiso);
                }
                setPendingAccessRequest(state.solicitudPendiente);
                setAccessNow(Date.now());
            } catch (error) {
                console.error('[member health] no se pudo verificar el acceso temporal', error);
                if (active) toast.error('No se pudo verificar el permiso de acceso médico.');
            } finally {
                if (active) setAccessLoading(false);
            }
        };

        loadAccess();
        return () => {
            active = false;
        };
    }, [currentMember, shouldCheckAccess, user]);

    useEffect(() => {
        let active = true;

        const loadHealthData = async () => {
            if (!memberId || accessLoading || (requiresTemporaryAccess && !accessPermission)) return;

            try {
                const healthData = await obtenerSaludMiembro(memberId, {
                    secciones: allowedHealthSections,
                });

                if (!active) return;

                const merged = {
                    ...getValues(),
                    ...healthData,
                    medicalConditions: {
                        ...DEFAULT_MEDICAL_CONDITIONS,
                        ...getValues('medicalConditions'),
                        ...healthData.medicalConditions,
                    },
                };

                reset(merged);
                // El "antes" para el diff de la solicitud: valores realmente
                // guardados con los que se cargo el formulario.
                valoresAnterioresRef.current = pickHealthValues(merged);
            } catch (error) {
                console.error(error);
                toast.error('No se pudo cargar la información de salud.');
            }
        };

        loadHealthData();

        return () => {
            active = false;
        };
    }, [
        accessLoading,
        accessPermission,
        allowedHealthSections,
        getValues,
        memberId,
        reset,
        requiresTemporaryAccess,
    ]);

    const onSubmit = handleSubmit(
        async (data) => {
            try {
                await guardarSaludMiembro({
                    idMiembros: memberId,
                    codigoMiembro: currentMember?.memberId || currentMember?.codigoMiembro || '',
                    data,
                    usuario: user,
                });

                reset(data);
                valoresAnterioresRef.current = pickHealthValues(data);
                toast.success('Información de salud guardada');

                // Guardado directo de un coordinador: avisar al OTRO coordinador
                // (nunca a sí mismo).
                if (isCoordinador) {
                    const segmento = currentMember?.memberId
                        ? encodeURIComponent(currentMember.memberId)
                        : currentMember?.id;

                    notificarCoordinadoresActualizacionDirecta({
                        member: currentMember,
                        actorId: user?.uid || user?.id || 'sistema',
                        actorIdMiembros: user?.idMiembros ?? user?.id ?? null,
                        actorNombre: user?.displayName || 'Un coordinador',
                        moduloTexto: 'la Dispensa Médica',
                        ruta: segmento
                            ? paths.dashboard.level.member.editHealth(segmento)
                            : '/dashboard',
                    }).catch(() => null);
                }
            } catch (error) {
                console.error(error);
                toast.error(error.message || 'No se pudo guardar la información de salud.');
            }
        },
        (errors) => {
            console.error('Errores del formulario de salud:', errors);
            toast.error('Revisa los campos de salud antes de guardar.');
        }
    );

    // --- Flujo Líder de Grupo: enviar cambios a aprobación ---------------------
    const handleRequestApproval = async () => {
        const antes = valoresAnterioresRef.current || {};
        const ahora = pickHealthValues(getValues());
        const cambios = construirCambiosSalud(antes, ahora);

        if (!cambios.length) {
            toast.info('No hay cambios para enviar a aprobación.');
            return;
        }

        setSendingApproval(true);

        try {
            const nombreMiembro =
                [currentMember?.firstName, currentMember?.lastName].filter(Boolean).join(' ').trim() ||
                currentMember?.name ||
                currentMember?.memberId ||
                'Miembro';

            const solicitud = await crearSolicitudCambioMiembro({
                idMiembros: currentMember?.id ? Number(currentMember.id) : null,
                codigoMiembro: currentMember?.memberId || currentMember?.codigoMiembro || '',
                nombreMiembro,
                idDestacamento: Number(currentMember?.destId || currentMember?.idDestacamento) || null,
                modulo: MODULOS_SOLICITUD_CAMBIO.salud,
                solicitadoPorUid: user?.uid || user?.id || '',
                solicitadoPorNombre:
                    user?.displayName ||
                    [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
                    'Líder de Grupo',
                solicitadoPorRol: user?.rolId || user?.roleId || user?.rol || user?.role || '',
                cambios,
                valoresPropuestos: ahora,
                valoresAnteriores: antes,
            });

            const segmento = currentMember?.memberId
                ? encodeURIComponent(currentMember.memberId)
                : currentMember?.id;

            const enviadas = await notificarCoordinadoresCambioMiembro({
                currentMember,
                nombreMiembro,
                nombreSolicitante:
                    user?.displayName ||
                    [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
                    'Un líder de grupo',
                actorId: user?.uid || user?.id || 'sistema',
                ruta: segmento
                    ? `${paths.dashboard.level.member.editHealth(segmento)}?solicitud=${solicitud.id}`
                    : '/dashboard',
                onInfo: (mensaje) => toast.info(mensaje),
            });

            if (!enviadas) {
                toast.warning('Se registró la solicitud, pero no se pudo notificar a un coordinador.');
            } else {
                toast.success('Se envió una notificación a tus Coordinadores.');
            }

            setLeaderPendingRequest(solicitud);
        } catch (approvalError) {
            console.error('[member health] no se pudo enviar la solicitud de aprobacion', approvalError);
            toast.error('No se pudo enviar la solicitud a tus Coordinadores.');
        } finally {
            setSendingApproval(false);
        }
    };

    // --- Coordinador: cargar la solicitud pendiente de salud -------------------
    useEffect(() => {
        let activo = true;

        if (!currentMember?.id) {
            return undefined;
        }

        (async () => {
            try {
                const solicitud = solicitudIdFromUrl
                    ? await obtenerSolicitudCambioPorId(solicitudIdFromUrl)
                    : await obtenerSolicitudPendientePorMiembro(Number(currentMember.id));

                if (!activo) return;

                if (
                    !solicitud ||
                    solicitud.estado !== ESTADOS_SOLICITUD_CAMBIO.pendiente ||
                    getModuloSolicitud(solicitud) !== MODULOS_SOLICITUD_CAMBIO.salud
                ) {
                    return;
                }

                if (mustRequestApproval) {
                    setLeaderPendingRequest(solicitud);
                } else if (puedeAprobarCambios) {
                    // Revisar/aprobar exige el permiso `miembros.aprobar_cambios`.
                    setChangeRequest(solicitud);
                    setChangeRequestOpen(Boolean(solicitudIdFromUrl));
                }
            } catch (error) {
                console.error('[member health] no se pudo cargar la solicitud de cambio', error);
            }
        })();

        return () => {
            activo = false;
        };
    }, [solicitudIdFromUrl, mustRequestApproval, puedeAprobarCambios, currentMember?.id]);

    const irARutaSalud = (query = '') => {
        const segmento = currentMember?.memberId
            ? encodeURIComponent(currentMember.memberId)
            : currentMember?.id;

        if (segmento) {
            router.replace(`${paths.dashboard.level.member.editHealth(segmento)}${query}`);
        }
    };

    const cerrarSolicitud = () => {
        setChangeRequestOpen(false);
        irARutaSalud();
    };

    const handleSendAccessRequest = async (justificacion) => {
        setSendingAccessRequest(true);
        try {
            const solicitud = await crearSolicitudAccesoSalud({
                member: currentMember,
                usuario: user,
                justificacion,
            });
            setPendingAccessRequest(solicitud);
            setAccessRequestOpen(false);
            toast.success('Solicitud enviada a los Coordinadores de Destacamento.');
        } catch (error) {
            console.error('[member health] no se pudo solicitar acceso', error);
            toast.error(error.message || 'No se pudo enviar la solicitud de acceso.');
        } finally {
            setSendingAccessRequest(false);
        }
    };

    useEffect(() => {
        let active = true;
        // El servicio exige además ser coordinador DE ESE destacamento al resolver.
        if (!accessRequestIdFromUrl || !isCoordinador || !puedeAutorizarAccesoMenores) {
            return undefined;
        }

        obtenerSolicitudAccesoSaludPorId(accessRequestIdFromUrl)
            .then((solicitud) => {
                if (!active || !solicitud) return;
                setAccessReview(solicitud);
                setAccessReviewOpen(true);
            })
            .catch((error) => {
                console.error('[member health] no se pudo cargar la solicitud de acceso', error);
                toast.error('No se pudo cargar la solicitud de acceso.');
            });

        return () => {
            active = false;
        };
    }, [accessRequestIdFromUrl, isCoordinador, puedeAutorizarAccesoMenores]);

    useEffect(() => {
        let active = true;
        if (!accessResultIdFromUrl) return undefined;

        obtenerSolicitudAccesoSaludPorId(accessResultIdFromUrl)
            .then((solicitud) => {
                if (active && solicitud?.solicitadoPorUid === String(user?.uid || user?.id || '')) {
                    setAccessResult(solicitud);
                }
            })
            .catch(() => null);

        return () => {
            active = false;
        };
    }, [accessResultIdFromUrl, user?.id, user?.uid]);

    const closeAccessReview = () => {
        setAccessReviewOpen(false);
        setAccessReview(null);
        irARutaSalud();
    };

    const handleResolveAccess = async ({ decision, duracion, secciones }) => {
        if (!accessReview?.id) return;
        setResolvingAccess(true);
        try {
            await resolverSolicitudAccesoSalud({
                idSolicitud: accessReview.id,
                decision,
                duracion,
                secciones,
                usuario: user,
            });
            toast.success(decision === 'aprobar' ? 'Permiso concedido.' : 'Solicitud rechazada.');
            closeAccessReview();
        } catch (error) {
            console.error('[member health] no se pudo resolver el acceso', error);
            toast.error(error.message || 'No se pudo resolver la solicitud.');
        } finally {
            setResolvingAccess(false);
        }
    };

    // --- Solicitante: ver resultado (?resultado=<id>) --------------------------
    useEffect(() => {
        let activo = true;

        if (!resultadoIdFromUrl) {
            return undefined;
        }

        (async () => {
            try {
                const solicitud = await obtenerSolicitudCambioPorId(resultadoIdFromUrl);

                if (!activo || !solicitud) return;

                setChangeResult(solicitud);
                setChangeResultOpen(true);
            } catch (error) {
                console.error('[member health] no se pudo cargar el resultado de la solicitud', error);
            }
        })();

        return () => {
            activo = false;
        };
    }, [resultadoIdFromUrl]);

    const cerrarResultado = () => {
        setChangeResultOpen(false);
        irARutaSalud();
    };

    const notificarResultadoAlSolicitante = async (solicitud, decision) => {
        if (!solicitud?.solicitadoPorUid) return;

        const resultado = clasificarResultadoSolicitud({ resultadoCampos: decision });
        const etiqueta = RESULTADO_SOLICITUD_LABEL[resultado] || 'Resuelto';
        const segmento = solicitud.codigoMiembro
            ? encodeURIComponent(solicitud.codigoMiembro)
            : solicitud.idMiembros;

        await crearNotificacionAdmin({
            tipoNotificacion: 'resultado_cambio_miembro',
            modulo: 'miembros',
            titulo: 'Resultado de tu solicitud (Dispensa Médica)',
            mensaje: `Tu solicitud de cambios en ${solicitud.nombreMiembro || 'un miembro'}: ${etiqueta.toLowerCase()}.`,
            prioridad: 'informativa',
            entidadTipo: 'miembro',
            entidadId: String(solicitud.idMiembros || ''),
            ruta: segmento
                ? `${paths.dashboard.level.member.editHealth(segmento)}?resultado=${solicitud.id}`
                : '/dashboard',
            etiquetaAccion: 'Ver',
            actorId: user?.uid || user?.id || 'sistema',
            actorNombre: user?.displayName || 'Coordinador de Destacamento',
            idsDestinatariosPrecalculados: [String(solicitud.solicitadoPorUid)],
        }).catch((error) => console.warn('[member health] no se pudo notificar al solicitante', error));
    };

    const handleResolveChangeRequest = async (decision = [], datosFinales = {}) => {
        if (!changeRequest) return;

        const aprobados = decision.filter((item) => item.aprobado);
        setResolvingChangeRequest(true);

        try {
            if (aprobados.length) {
                const dataFinal = { ...getValues(), ...datosFinales };

                await guardarSaludMiembro({
                    idMiembros: currentMember?.id,
                    codigoMiembro: currentMember?.memberId || currentMember?.codigoMiembro || '',
                    data: dataFinal,
                    usuario: user,
                });

                reset(dataFinal);
                valoresAnterioresRef.current = pickHealthValues(dataFinal);
            }

            const estado = !aprobados.length
                ? ESTADOS_SOLICITUD_CAMBIO.rechazada
                : aprobados.length === decision.length
                    ? ESTADOS_SOLICITUD_CAMBIO.aprobada
                    : ESTADOS_SOLICITUD_CAMBIO.parcial;

            await resolverSolicitudCambioMiembro(changeRequest.id, {
                estado,
                resultadoCampos: decision,
                resueltoPorUid: user?.uid || user?.id || '',
                resueltoPorNombre: user?.displayName || 'Coordinador de Destacamento',
            });

            await notificarResultadoAlSolicitante(changeRequest, decision);

            toast.success(
                estado === ESTADOS_SOLICITUD_CAMBIO.rechazada
                    ? 'Solicitud rechazada.'
                    : 'Cambios aplicados.'
            );

            setChangeRequest(null);
            cerrarSolicitud();
        } catch (error) {
            console.error('[member health] no se pudo resolver la solicitud', error);
            toast.error('No se pudo procesar la solicitud.');
        } finally {
            setResolvingChangeRequest(false);
        }
    };

    const openBasic = useBoolean(false);
    const openDocument = useBoolean(false);
    const openMedication = useBoolean(false);
    const openAllergies = useBoolean(false);
    const openConditions = useBoolean(false);

    const table = useTable({ defaultRowsPerPage: 10 });

    const {
        medicalDocuments,
        canDeleteDocuments,
        deleteOne,
        deleteSelected,
        openUploadDialog,
        uploadDroppedFiles,
        FileInput,
        renameDocument,
    } = useMedicalDocuments({
        memberId,
        codigoMiembro: currentMember?.memberId || currentMember?.codigoMiembro || '',
        table,
        enabled: !accessLoading && canAccessSection('documentos'),
    });


    const newFilesDialog = useBoolean();
    const confirmDialog = useBoolean();

    const handleAddMedication = () => {
        if (fields.length >= 5) return;

        append({
            name: '',
            dose: '',
            schedule: [],
        });
    };

    const handleConfirmDeleteSelected = () => {
        if (!table.selected.length) return;
        confirmDialog.onTrue();
    };

    const handleRemoveLastMedication = () => {
        if (fields.length <= 1) return;
        remove(fields.length - 1);
    };

    const renderCollapseButton = (value, onToggle) => (
        <IconButton
            component="span"
            role="button"
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggle();
                }
            }}
        >
            <Iconify
                icon={value ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'}
            />
        </IconButton>
    );

    const renderSectionCollapseButton = (section, value, onToggle) =>
        canAccessSection(section) ? renderCollapseButton(value, onToggle) : null;

    const getSectionFieldsetSx = (section) => ({
        border: 0,
        p: 0,
        m: 0,
        minWidth: 0,
        ...(!canAccessSection(section) && {
            '& .MuiCardHeader-root': {
                opacity: 0.45,
                filter: 'grayscale(1)',
                color: 'text.disabled',
            },
            '& .MuiCardHeader-title, & .MuiCardHeader-subheader': {
                color: 'text.disabled',
            },
        }),
    });

    const formatAccessDateTime = (value) => {
        const date = new Date(value || 0);
        if (Number.isNaN(date.getTime())) return 'sin fecha';
        return new Intl.DateTimeFormat('es-DO', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    };

    const formatApproverName = (value) => {
        const parts = String(value || 'Coordinador de Destacamento').trim().split(/\s+/).filter(Boolean);
        return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
    };

    // Props comunes del flujo de aprobacion que reciben las secciones editables.
    // (El prop se llama isGroupLeader por compatibilidad con las secciones, pero
    // aplica a todos los cargos de destacamento en flujo de aprobación.)
    const approvalProps = {
        isGroupLeader: mustRequestApproval,
        sendingApproval,
        onRequestApproval: handleRequestApproval,
    };

    const verCambiosPendientes = () => {
        setChangeResult(leaderPendingRequest);
        setChangeResultOpen(true);
    };

    return (
        <Form methods={methods} onSubmit={readOnly || mustRequestApproval ? undefined : onSubmit}>
            <Stack
                spacing={3}
                sx={{
                    mx: 'auto',
                    maxWidth: { xs: 720, xl: 880 },
                }}
            >
                {mustRequestApproval && (
                    <Card sx={{ p: 2.5 }}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.5}
                            alignItems={{ sm: 'center' }}
                            justifyContent="space-between"
                        >
                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                <Iconify icon="solar:shield-keyhole-bold" width={24} />
                                <Stack spacing={0.5}>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        Tus cambios en la Dispensa Médica se envían a tu Coordinador de
                                        Destacamento para aprobación.
                                    </Typography>
                                    {requiresTemporaryAccess && accessLoading && (
                                        <Typography variant="caption" color="text.secondary">
                                            Verificando permiso de acceso a la información del menor...
                                        </Typography>
                                    )}
                                    {requiresTemporaryAccess && accessPermission && (
                                        <Typography variant="caption" color="success.main">
                                            Acceso disponible por {formatearTiempoRestanteAccesoSalud(accessPermission, accessNow)}.
                                            {' '}Autorizado por {formatApproverName(
                                                accessPermission.resueltoPorNombreCorto || accessPermission.resueltoPorNombre
                                            )}.
                                            {' '}Válido hasta {accessPermission.duracion === DURACIONES_ACCESO_SALUD.unaVez
                                                ? 'completar esta visualización'
                                                : formatAccessDateTime(accessPermission.fechaExpiracion)}.
                                        </Typography>
                                    )}
                                    {requiresTemporaryAccess && !accessLoading && !accessPermission && (
                                        <Typography variant="caption" color="warning.main">
                                            La información médica de este menor está protegida y los desplegables
                                            permanecerán deshabilitados hasta recibir autorización.
                                        </Typography>
                                    )}
                                </Stack>
                            </Stack>

                            <Stack direction="column" spacing={1}>
                                {requiresTemporaryAccess && !accessPermission && (
                                    <Button
                                        variant="contained"
                                        disabled={accessLoading || Boolean(pendingAccessRequest)}
                                        startIcon={<Iconify icon="solar:key-bold" />}
                                        onClick={() => setAccessRequestOpen(true)}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        {pendingAccessRequest ? 'Solicitud pendiente' : 'Solicitar acceso'}
                                    </Button>
                                )}
                                {leaderPendingRequest && (
                                    <Button
                                        color="warning"
                                        variant="outlined"
                                        startIcon={<Iconify icon="solar:clock-circle-bold" />}
                                        onClick={verCambiosPendientes}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        Ver cambios pendientes
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </Card>
                )}

                {accessResult && (
                    <Alert severity={accessResult.estado === 'aprobada' ? 'success' : 'error'}>
                        {accessResult.estado === 'aprobada'
                            ? `Acceso válido hasta ${
                                accessResult.duracion === DURACIONES_ACCESO_SALUD.unaVez
                                    ? 'completar una única visualización'
                                    : formatAccessDateTime(accessResult.fechaExpiracion)
                            }. Autorizado por ${formatApproverName(
                                accessResult.resueltoPorNombreCorto || accessResult.resueltoPorNombre
                            )}.`
                            : 'La solicitud de acceso fue rechazada.'}
                    </Alert>
                )}

                <Box component="fieldset" disabled={!canAccessSection('general')} sx={getSectionFieldsetSx('general')}>
                    <HealthBasicSection
                        open={canAccessSection('general') && openBasic.value}
                        onToggle={openBasic.onToggle}
                        renderCollapseButton={(value, onToggle) =>
                            renderSectionCollapseButton('general', value, onToggle)
                        }
                        watch={watch}
                        setValue={setValue}
                        setError={setError}
                        clearErrors={clearErrors}
                        isSubmitting={isSubmitting}
                        masked={limitedHealth}
                        maskInsurance={maskHealthInsurance}
                        readOnly={readOnly}
                        {...approvalProps}
                    />
                </Box>

                <Box component="fieldset" disabled={!canAccessSection('documentos')} sx={getSectionFieldsetSx('documentos')}>
                    <HealthDocumentsSection
                        open={canAccessSection('documentos') && openDocument.value}
                        onToggle={openDocument.onToggle}
                        renderCollapseButton={(value, onToggle) =>
                            renderSectionCollapseButton('documentos', value, onToggle)
                        }
                        table={table}
                        medicalDocuments={medicalDocuments}
                        onRename={renameDocument}
                        onDeleteOne={deleteOne}
                        onDeleteSelected={handleConfirmDeleteSelected}
                        canDelete={canDeleteDocuments && puedeEliminarDocumentos}
                        onUpload={openUploadDialog}
                        onDropUpload={uploadDroppedFiles}
                        readOnly={
                            readOnly || !canAccessSection('documentos') || !puedeSubirDocumentos
                        }
                        compactEmptyState={isSupervisoryViewerRole}
                    />
                </Box>

                <Box component="fieldset" disabled={!canAccessSection('medicacion')} sx={getSectionFieldsetSx('medicacion')}>
                    <HealthMedicationSection
                        open={canAccessSection('medicacion') && openMedication.value}
                        onToggle={openMedication.onToggle}
                        renderCollapseButton={(value, onToggle) =>
                            renderSectionCollapseButton('medicacion', value, onToggle)
                        }
                        fields={fields}
                        watch={watch}
                        setValue={setValue}
                        onAdd={handleAddMedication}
                        onRemove={handleRemoveLastMedication}
                        isSubmitting={isSubmitting}
                        readOnly={readOnly}
                        {...approvalProps}
                    />
                </Box>

                <Box component="fieldset" disabled={!canAccessSection('alergias')} sx={getSectionFieldsetSx('alergias')}>
                    <HealthAllergiesSection
                        open={canAccessSection('alergias') && openAllergies.value}
                        onToggle={openAllergies.onToggle}
                        renderCollapseButton={(value, onToggle) =>
                            renderSectionCollapseButton('alergias', value, onToggle)
                        }
                        methods={methods}
                        watch={watch}
                        setValue={setValue}
                        isSubmitting={isSubmitting}
                        readOnly={readOnly}
                        {...approvalProps}
                    />
                </Box>

                <Box component="fieldset" disabled={!canAccessSection('condiciones')} sx={getSectionFieldsetSx('condiciones')}>
                    <HealthConditionsSection
                        open={canAccessSection('condiciones') && openConditions.value}
                        onToggle={openConditions.onToggle}
                        renderCollapseButton={(value, onToggle) =>
                            renderSectionCollapseButton('condiciones', value, onToggle)
                        }
                        watch={watch}
                        setValue={setValue}
                        isSubmitting={isSubmitting}
                        readOnly={readOnly}
                        {...approvalProps}
                    />
                </Box>

            </Stack>
            <FileManagerCreateFolderDialog
                open={newFilesDialog.value}
                onClose={newFilesDialog.onFalse}
            />

            {FileInput}

            <ConfirmDialog
                open={confirmDialog.value}
                onClose={confirmDialog.onFalse}
                title="Eliminar"
                content="¿Está seguro que desea eliminar los documentos seleccionados?"
                action={
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => {
                            deleteSelected();
                            confirmDialog.onFalse();
                        }}
                    >
                        Eliminar
                    </Button>
                }
            />

            <MemberHealthChangeRequestDialog
                open={changeRequestOpen}
                solicitud={changeRequest}
                saving={resolvingChangeRequest}
                onClose={cerrarSolicitud}
                onResolve={handleResolveChangeRequest}
            />

            <MemberChangeResultDialog
                open={changeResultOpen}
                solicitud={changeResult}
                onClose={cerrarResultado}
            />

            <MemberHealthAccessRequestDialog
                open={accessRequestOpen}
                saving={sendingAccessRequest}
                onClose={() => setAccessRequestOpen(false)}
                onSubmit={handleSendAccessRequest}
            />

            <MemberHealthAccessReviewDialog
                open={accessReviewOpen}
                solicitud={accessReview}
                saving={resolvingAccess}
                onClose={closeAccessReview}
                onResolve={handleResolveAccess}
            />

        </Form>


    );
}
