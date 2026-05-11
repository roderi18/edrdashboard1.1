'use client';

// React
import { useEffect } from 'react';
// Hooks
import { useBoolean } from 'minimal-shared/hooks';
// Validaciones / forms
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';

// MUI components
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';

import { guardarSaludMiembro, obtenerSaludMiembro } from 'src/services/member-health-service';

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

import { useMedicalDocuments } from './health/hooks/use-medical-documents';

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

                reset({
                    ...getValues(),
                    ...healthData,
                    medicalConditions: {
                        ...DEFAULT_MEDICAL_CONDITIONS,
                        ...getValues('medicalConditions'),
                        ...healthData.medicalConditions,
                    },
                });
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
                toast.success('Información de salud guardada');
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

    const openBasic = useBoolean(false);
    const openDocument = useBoolean(false);
    const openMedication = useBoolean(false);
    const openAllergies = useBoolean(false);
    const openConditions = useBoolean(false);

    const table = useTable({ defaultRowsPerPage: 10 });

    const {
        medicalDocuments,
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

    return (
        <Form methods={methods} onSubmit={readOnly ? undefined : onSubmit}>
            <Box component="fieldset" disabled={readOnly} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Stack
                spacing={5}
                sx={{
                    mx: 'auto',
                    maxWidth: { xs: 720, xl: 880 },
                }}
            >
                <HealthBasicSection
                    open={openBasic.value}
                    onToggle={openBasic.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    watch={watch}
                    setValue={setValue}
                    setError={setError}
                    clearErrors={clearErrors}
                    isSubmitting={isSubmitting}
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
                    onUpload={openUploadDialog}
                    onDropUpload={uploadDroppedFiles}
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
                />

                <HealthAllergiesSection
                    open={openAllergies.value}
                    onToggle={openAllergies.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    methods={methods}
                    watch={watch}
                    setValue={setValue}
                    isSubmitting={isSubmitting}
                />

                <HealthConditionsSection
                    open={openConditions.value}
                    onToggle={openConditions.onToggle}
                    renderCollapseButton={renderCollapseButton}
                    watch={watch}
                    setValue={setValue}
                    isSubmitting={isSubmitting}
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

        </Form>


    );
}
