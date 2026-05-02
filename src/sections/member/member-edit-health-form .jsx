'use client';

// React
import { useState, useEffect } from 'react';

// Validaciones / forms
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';

// Hooks
import { useBoolean } from 'minimal-shared/hooks';
import { useRouter } from 'src/routes/hooks';

// MUI components
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

import IconButton from '@mui/material/IconButton';
import { ConfirmDialog } from 'src/components/custom-dialog';

// Table components
import { useTable, } from 'src/components/table';

// Custom components
import { Iconify } from 'src/components/iconify';
import { toast } from 'src/components/snackbar';
import { MemberHealthSchema } from 'src/sections/member/health/schema';
import { HealthDocumentsSection } from 'src/sections/member/health/sections/health-documents-section';
import { HealthMedicationSection } from 'src/sections/member/health/sections/health-medication-section';
import { HealthAllergiesSection } from 'src/sections/member/health/sections/health-allergies-section';
import { HealthBasicSection } from 'src/sections/member/health/sections/health-basic-section';
import { HealthConditionsSection } from 'src/sections/member/health/sections/health-conditions-section';

// Hook form components 
import { Form, Field } from 'src/components/hook-form';
import { useMedicalDocuments } from './health/hooks/use-medical-documents';

// File manager
import { FileManagerCreateFolderDialog } from 'src/sections/file-manager/file-manager-create-folder-dialog';

// Utils / mocks
import { _allFiles } from 'src/_mock';
import { getMembers } from 'src/services/member-service';
import { MEDICAL_DOCUMENTS } from 'src/_mock/health';

import { countMembersByDestId } from 'src/utils/member-count';

export function MemberEditHealthForm({ currentMember, readOnly = false }) {
    const memberId = currentMember?.id;

    const normalizedMember = {
        ...currentMember,
        healthInsurance: currentMember?.healthInsurance ?? ['unknown'],
    };

    const [insuranceTouched, setInsuranceTouched] = useState(false);

    const router = useRouter();

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
        allergyReaction: '',
        hasMedication: 'no',
        useDuringActivities: 'no',
        selfAdministered: 'yes',
        hasFoodAllergies: 'no',
        hasEnvironmentalAllergies: 'no',
        foodAllergies: [],
        environmentalAllergies: [],

        allergyReaction: 'mild',

        // condiciones médicas
        hasMedicalConditions: 'no',

        medicalConditions: {
            asthma: false,
            diabetes: false,
            epilepsy: false,
            hypertension: false,
            heart_problems: false,
            respiratory_problems: false,
            eating_disorders: false,
            other: false,
        },

        medicalConditionsOther: '',

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
        setValue,
        setError,
        clearErrors,
        handleSubmit,
        formState: { isSubmitting },
    } = methods;

    const values = watch();
    const healthInsurance = watch('healthInsurance');

    useEffect(() => {
        if (healthInsurance !== 'yes') {
            setValue('insuranceName', '');
            setValue('policyNumber', '');
            setInsuranceTouched(false);
        }
    }, [healthInsurance, setValue]);

    const showInsuranceError =
        insuranceTouched && healthInsurance !== 'yes';

    const destId = currentMember?.destId;

    const members = getMembers();

    const membersCount = countMembersByDestId(members, destId);

    const onSubmit = handleSubmit(async (data) => {
        try {
            await new Promise((resolve) => setTimeout(resolve, 500));
            reset();
            toast.success('Destacamento actualizado');
            // router.push(paths.dashboard.level.member); //anteriormente .list
            console.info('DATA', data);
        } catch (error) {
            console.error(error);
        }
    });

    const openBasic = useBoolean(false);
    const openDocument = useBoolean(false);
    const openMedication = useBoolean(false);
    const openAllergies = useBoolean(false);
    const openConditions = useBoolean(false);
    const [showScheduleNotes, setShowScheduleNotes] = useState({});

    const table = useTable({ defaultRowsPerPage: 10 });

    const {
        medicalDocuments,
        deleteOne,
        deleteSelected,
        openUploadDialog,
        FileInput,
        renameDocument,
    } = useMedicalDocuments({
        memberId,
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
