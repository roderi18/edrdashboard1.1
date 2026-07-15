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
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import {
  canDeleteHealthDocuments,
  isDestacamentoApprovalRole,
  isCoordinadorDestacamentoRole,
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
    const puedeEliminarDocumentos = canDeleteHealthDocuments(user);

    const solicitudIdFromUrl = searchParams?.get('solicitud') || '';
    const resultadoIdFromUrl = searchParams?.get('resultado') || '';

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
        let active = true;

        const loadHealthData = async () => {
            if (!memberId) return;

            try {
                const healthData = await obtenerSaludMiembro(memberId);

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
    }, [getValues, memberId, reset]);

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
                solicitadoPorRol: 'lider_grupo',
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

                if (isApprovalUser) {
                    setLeaderPendingRequest(solicitud);
                } else {
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
    }, [solicitudIdFromUrl, isApprovalUser, currentMember?.id]);

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
        <IconButton onClick={onToggle}>
            <Iconify
                icon={value ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'}
            />
        </IconButton>
    );

    // Props comunes del flujo de aprobacion que reciben las secciones editables.
    // (El prop se llama isGroupLeader por compatibilidad con las secciones, pero
    // aplica a todos los cargos de destacamento en flujo de aprobación.)
    const approvalProps = {
        isGroupLeader: isApprovalUser,
        sendingApproval,
        onRequestApproval: handleRequestApproval,
    };

    const verCambiosPendientes = () => {
        setChangeResult(leaderPendingRequest);
        setChangeResultOpen(true);
    };

    return (
        <Form methods={methods} onSubmit={readOnly || isApprovalUser ? undefined : onSubmit}>
            <Box component="fieldset" disabled={readOnly} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Stack
                spacing={3}
                sx={{
                    mx: 'auto',
                    maxWidth: { xs: 720, xl: 880 },
                }}
            >
                {isApprovalUser && (
                    <Card sx={{ p: 2.5 }}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.5}
                            alignItems={{ sm: 'center' }}
                            justifyContent="space-between"
                        >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Iconify icon="solar:shield-keyhole-bold" width={24} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Tus cambios en la Dispensa Médica se envían a tu Coordinador de
                                    Destacamento para aprobación.
                                </Typography>
                            </Stack>

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
                    </Card>
                )}

                <HealthBasicSection
                    open={openBasic.value}
                    onToggle={openBasic.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    watch={watch}
                    setValue={setValue}
                    setError={setError}
                    clearErrors={clearErrors}
                    isSubmitting={isSubmitting}
                    {...approvalProps}
                />

                <HealthDocumentsSection
                    open={openDocument.value}
                    onToggle={openDocument.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    table={table}
                    medicalDocuments={medicalDocuments}
                    onRename={renameDocument}
                    onDeleteOne={deleteOne}
                    onDeleteSelected={handleConfirmDeleteSelected}
                    canDelete={canDeleteDocuments && puedeEliminarDocumentos}
                    onUpload={openUploadDialog}
                    onDropUpload={uploadDroppedFiles}
                    readOnly={readOnly}
                />

                <HealthMedicationSection
                    open={openMedication.value}
                    onToggle={openMedication.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    fields={fields}
                    watch={watch}
                    setValue={setValue}
                    onAdd={handleAddMedication}
                    onRemove={handleRemoveLastMedication}
                    isSubmitting={isSubmitting}
                    {...approvalProps}
                />

                <HealthAllergiesSection
                    open={openAllergies.value}
                    onToggle={openAllergies.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    methods={methods}
                    watch={watch}
                    setValue={setValue}
                    isSubmitting={isSubmitting}
                    {...approvalProps}
                />

                <HealthConditionsSection
                    open={openConditions.value}
                    onToggle={openConditions.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    watch={watch}
                    setValue={setValue}
                    isSubmitting={isSubmitting}
                    {...approvalProps}
                />

            </Stack>
            </Box>
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

        </Form>


    );
}
