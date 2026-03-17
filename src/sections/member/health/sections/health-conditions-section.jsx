'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import Collapse from '@mui/material/Collapse';

import { Field } from 'src/components/hook-form';
import RestrictedText from 'src/components/restricted/RestrictedText';

import { MEDICAL_CONDITIONS_OPTIONS } from 'src/_mock/health';

export function HealthConditionsSection({
    open,
    onToggle,
    renderCollapseButton,
    watch,
    setValue,
    isSubmitting,
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
                        <Typography variant="subtitle2">
                            ¿Presenta alguna condición médica?
                        </Typography>

                        <Field.RadioGroup
                            row
                            name="hasMedicalConditions"
                            options={[
                                { label: 'No', value: 'no' },
                                { label: 'Sí', value: 'yes' },
                            ]}
                            sx={{ gap: 4 }}
                        />
                    </Stack>

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
                                {MEDICAL_CONDITIONS_OPTIONS.map((item) => (
                                    <Field.Checkbox
                                        key={item.id}
                                        name={`medicalConditions.${item.id}`}
                                        label={item.label}
                                    />
                                ))}
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
                                />
                            )}
                        </>
                    )}

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
