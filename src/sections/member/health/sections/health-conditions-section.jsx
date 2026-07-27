'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';

import { MEDICAL_CONDITIONS_OPTIONS } from 'src/_mock/health';

import { Field } from 'src/components/hook-form';
import RestrictedText from 'src/components/restricted/RestrictedText';

import { HealthSectionSubmit } from 'src/sections/member/health/componentes/HealthSectionSubmit';

export function HealthConditionsSection({
    open,
    onToggle,
    renderCollapseButton,
    watch,
    setValue,
    isSubmitting,
    readOnly = false,
    isGroupLeader = false,
    sendingApproval = false,
    onRequestApproval,
}) {
    return (
        <Card>
            <CardHeader
                title="🩺 Condiciones médicas"
                subheader="Condiciones médicas existentes y cuidados especiales"
                action={renderCollapseButton(open, onToggle)}
                sx={{ mb: 3 }}
            />

            <Collapse in={open}>
                <Divider />

                <Stack spacing={3} sx={{ p: 3 }}>
                    <Stack spacing={1}>
                        {!readOnly && (
                            <Typography variant="subtitle2">
                                ¿Presenta alguna condición médica?
                            </Typography>
                        )}

                        {!readOnly && (
                            <Field.RadioGroup
                                row
                                name="hasMedicalConditions"
                                options={[
                                    { label: 'No', value: 'no' },
                                    { label: 'Sí', value: 'yes' },
                                ]}
                                sx={{ gap: 4 }}
                            />
                        )}
                    </Stack>

                    {readOnly && watch('hasMedicalConditions') !== 'yes' && (
                        <Typography variant="body2" color="text.secondary">
                            Sin información registrada.
                        </Typography>
                    )}

                    {/* ✅ CONDICIONES (solo si aplica) */}
                    {watch('hasMedicalConditions') === 'yes' && (
                        <>
                            <Box
                                sx={{
                                    rowGap: 1.5,
                                    columnGap: 2,
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: 'repeat(1, 1fr)',
                                        sm: 'repeat(2, 1fr)',
                                    },
                                }}
                            >
                                {readOnly ? (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ gridColumn: '1 / -1' }}
                                    >
                                        {MEDICAL_CONDITIONS_OPTIONS
                                            .filter((item) => watch(`medicalConditions.${item.id}`))
                                            .map((item) => item.label)
                                            .join(', ') || 'Sin información registrada.'}
                                    </Typography>
                                ) : (
                                    MEDICAL_CONDITIONS_OPTIONS.map((item) => (
                                        <Field.Checkbox
                                            key={item.id}
                                            name={`medicalConditions.${item.id}`}
                                            label={item.label}
                                        />
                                    ))
                                )}
                            </Box>

                            {watch('medicalConditions.other') && (
                                <RestrictedText
                                    label="Otras condiciones"
                                    value={watch('medicalConditionsOther') || ''}
                                    onChange={(val) =>
                                        setValue('medicalConditionsOther', val)
                                    }
                                    allow="all"
                                    maxLength={100}
                                    multiline
                                    rows={2}
                                    readOnly={readOnly}
                                />
                            )}

                            {watch('medicalConditions.surgery') && (
                                <RestrictedText
                                    label="Detalle de la operación"
                                    value={watch('surgeryDetails') || ''}
                                    onChange={(val) =>
                                        setValue('surgeryDetails', val)
                                    }
                                    allow="all"
                                    maxLength={100}
                                    multiline
                                    rows={2}
                                    readOnly={readOnly}
                                />
                            )}
                        </>
                    )}

                    {!readOnly && (
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
