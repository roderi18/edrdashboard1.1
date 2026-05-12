'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';

import { AsYouType } from 'libphonenumber-js';

import { Field } from 'src/components/hook-form';
import RestrictedText from 'src/components/restricted/RestrictedText';
import RestrictedSelect from 'src/components/restricted/RestrictedSelect';
import HeightInput from 'src/components/form/HeightInput';
import WeightInput from 'src/components/form/WeightInput';

import {
    HEALTH_INSURANCE_OPTIONS,
    HEALTH_INSURANCE_COMPANIES,
    BLOOD_TYPE_OPTIONS,
    MEDICAL_RELATIONSHIP_OPTIONS,
} from 'src/_mock/health';

export function HealthBasicSection({
    open,
    onToggle,
    renderCollapseButton,
    watch,
    setValue,
    setError,
    clearErrors,
    isSubmitting,
}) {
    const healthInsurance = watch('healthInsurance');

    return (
        <Card>
            <CardHeader
                title="🧾 Información médica básica"
                subheader="Datos generales de salud y contactos médicos"
                action={renderCollapseButton(open, onToggle)}
                sx={{ mb: 3 }}
            />

            <Collapse in={open}>
                <Divider />

                <Stack spacing={3} sx={{ p: 3 }}>
                    <Box
                        sx={{
                            rowGap: 3,
                            columnGap: 2,
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: 'repeat(1, 1fr)',
                                sm: 'repeat(2, 1fr)',
                            },
                        }}
                    >
                        <Field.Select
                            name="healthInsurance"
                            label="¿Tiene seguro médico?"
                        >
                            {HEALTH_INSURANCE_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Field.Select>

                        <Field.Select
                            name="bloodType"
                            label="Tipo de sangre"
                            defaultValue="unknown"
                        >
                            {BLOOD_TYPE_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Field.Select>

                        <RestrictedSelect
                            name="insuranceName"
                            label="Nombre del Seguro (opcional)"
                            conditions={[
                                { value: healthInsurance, allowed: 'yes' },
                            ]}
                            errorText="Disponible solo si tiene seguro médico."
                        >
                            {HEALTH_INSURANCE_COMPANIES.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </RestrictedSelect>

                        <HeightInput watch={watch} setValue={setValue} />

                        <RestrictedText
                            label="Número de póliza (opcional)"
                            value={watch('policyNumber') || ''}
                            onChange={(val) => setValue('policyNumber', val)}
                            maxLength={12}
                            allow="numbers"
                            message="Solo se permiten números."
                            readOnly={healthInsurance !== 'yes'}
                            useTouched
                            blockedErrorText="Disponible solo si tiene seguro médico."
                        />

                        <WeightInput watch={watch} setValue={setValue} />

                        <Divider sx={{ gridColumn: '1 / -1', my: 0.5 }}>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'text.secondary',
                                    px: 2,
                                    fontWeight: 600,
                                    letterSpacing: 0.5,
                                    backgroundColor: 'background.paper',
                                }}
                            >
                                Contacto médico / responsable
                            </Typography>
                        </Divider>

                        <RestrictedText
                            label="Nombre del responsable médico (padre/madre/tutor)"
                            value={watch('medicalContactName') || ''}
                            onChange={(val) => setValue('medicalContactName', val)}
                            allow="all"
                            maxLength={60}
                            useTouched
                        />

                        <Field.Text
                            name="medicalPrimaryPhone"
                            label="Teléfono principal"
                            placeholder="(809) 555-1234"
                            inputProps={{ inputMode: 'numeric' }}
                            onChange={(e) => {
                                const raw = e.target.value;

                                if (/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(raw)) {
                                    setError('medicalPrimaryPhone', {
                                        type: 'manual',
                                        message: 'Solo se permiten números.',
                                    });
                                } else {
                                    clearErrors('medicalPrimaryPhone');
                                }

                                const digits = raw.replace(/\D/g, '').slice(0, 10);
                                const formatted = new AsYouType('DO').input(digits);
                                setValue('medicalPrimaryPhone', formatted);
                            }}
                        />

                        <Field.Select
                            name="medicalRelationship"
                            label="Relación con el miembro"
                        >
                            {MEDICAL_RELATIONSHIP_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Field.Select>

                        <Field.Text
                            name="medicalSecondaryPhone"
                            label="Teléfono de emergencia"
                            placeholder="(829) 555-1234"
                            inputProps={{ inputMode: 'numeric' }}
                            onChange={(e) => {
                                const raw = e.target.value;

                                if (/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(raw)) {
                                    setError('medicalSecondaryPhone', {
                                        type: 'manual',
                                        message: 'Solo se permiten números.',
                                    });
                                } else {
                                    clearErrors('medicalSecondaryPhone');
                                }

                                const digits = raw.replace(/\D/g, '').slice(0, 10);
                                const formatted = new AsYouType('DO').input(digits);
                                setValue('medicalSecondaryPhone', formatted);
                            }}
                        />
                    </Box>

                    <RestrictedText
                        label="Información médica adicional"
                        value={watch('medicalNotes') || ''}
                        onChange={(val) => setValue('medicalNotes', val)}
                        allow="all"
                        maxLength={500}
                        useTouched
                        multiline
                        rows={3}
                    />

                    <Stack alignItems="flex-end">
                        <Button
                            type="submit"
                            variant="contained"
                            loading={isSubmitting}
                        >
                            Guardar cambios
                        </Button>
                    </Stack>
                </Stack>
            </Collapse>
        </Card>
    );
}
