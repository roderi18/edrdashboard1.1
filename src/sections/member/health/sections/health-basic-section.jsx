'use client';

import { AsYouType } from 'libphonenumber-js';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';

import {
    BLOOD_TYPE_OPTIONS,
    HEALTH_INSURANCE_OPTIONS,
    HEALTH_INSURANCE_COMPANIES,
    MEDICAL_RELATIONSHIP_OPTIONS,
} from 'src/_mock/health';

import { Field } from 'src/components/hook-form';
import { MaskedField } from 'src/components/masked-field';
import HeightInput from 'src/components/form/HeightInput';
import WeightInput from 'src/components/form/WeightInput';
import RestrictedText from 'src/components/restricted/RestrictedText';
import RestrictedSelect from 'src/components/restricted/RestrictedSelect';

import { HealthSectionSubmit } from 'src/sections/member/health/componentes/HealthSectionSubmit';

export function HealthBasicSection({
    open,
    onToggle,
    renderCollapseButton,
    watch,
    setValue,
    setError,
    clearErrors,
    isSubmitting,
    isGroupLeader = false,
    sendingApproval = false,
    onRequestApproval,
    // Vista limitada para roles sin `salud.ver`: se muestran tipo de sangre,
    // estatura, peso, responsable médico, teléfonos e información adicional; el
    // resto se enmascara con asteriscos.
    masked = false,
    maskInsurance = masked,
    readOnly = false,
}) {
    const healthInsurance = watch('healthInsurance');
    const bloodType = watch('bloodType');
    const bloodTypeLabel =
        BLOOD_TYPE_OPTIONS.find((option) => option.value === bloodType)?.label ||
        'Sin información registrada';
    const medicalRelationship = watch('medicalRelationship');
    const medicalRelationshipLabel =
        MEDICAL_RELATIONSHIP_OPTIONS.find((option) => option.value === medicalRelationship)?.label ||
        medicalRelationship ||
        'Sin información registrada';

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
                        {maskInsurance ? (
                            <MaskedField label="¿Tiene seguro médico?" preset="text" />
                        ) : (
                            <Field.Select
                                name="healthInsurance"
                                label="¿Tiene seguro médico?"
                                disabled={readOnly}
                            >
                                {HEALTH_INSURANCE_OPTIONS.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Field.Select>
                        )}

                        {readOnly ? (
                            <MaskedField label="Tipo de sangre" mask={bloodTypeLabel} />
                        ) : (
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
                        )}

                        {maskInsurance ? (
                            <MaskedField label="Nombre del Seguro (opcional)" preset="text" />
                        ) : (
                            <RestrictedSelect
                                name="insuranceName"
                                label="Nombre del Seguro (opcional)"
                                readOnly={readOnly}
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
                        )}

                        <HeightInput watch={watch} setValue={setValue} readOnly={readOnly} />

                        {maskInsurance ? (
                            <MaskedField label="Número de póliza (opcional)" preset="text" />
                        ) : (
                            <RestrictedText
                                label="Número de póliza (opcional)"
                                value={watch('policyNumber') || ''}
                                onChange={(val) => setValue('policyNumber', val)}
                                maxLength={12}
                                allow="numbers"
                                message="Solo se permiten números."
                                readOnly={readOnly || healthInsurance !== 'yes'}
                                useTouched
                                blockedErrorText="Disponible solo si tiene seguro médico."
                            />
                        )}

                        <WeightInput watch={watch} setValue={setValue} readOnly={readOnly} />

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
                            readOnly={readOnly}
                            useTouched
                        />

                        <Field.Text
                            name="medicalPrimaryPhone"
                            label="Teléfono principal"
                            placeholder="(809) 555-1234"
                            disabled={readOnly}
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

                        {masked ? (
                            <MaskedField label="Relación con el miembro" preset="text" />
                        ) : readOnly ? (
                            <MaskedField
                                label="Relación con el miembro"
                                mask={medicalRelationshipLabel}
                            />
                        ) : (
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
                        )}

                        <Field.Text
                            name="medicalSecondaryPhone"
                            label="Teléfono de emergencia"
                            placeholder="(829) 555-1234"
                            disabled={readOnly}
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
                        readOnly={readOnly}
                        useTouched
                        multiline
                        rows={3}
                    />

                    {!masked && !readOnly && (
                        <HealthSectionSubmit
                            isSubmitting={isSubmitting}
                            isGroupLeader={isGroupLeader}
                            sendingApproval={sendingApproval}
                            onRequestApproval={onRequestApproval}
                        />
                    )}
                </Stack>
            </Collapse>
        </Card>
    );
}
