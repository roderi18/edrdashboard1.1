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

import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';
import RestrictedText from 'src/components/restricted/RestrictedText';

import {
    MEDICATION_OPTIONS,
    MEDICATION_SCHEDULE_OPTIONS,
} from 'src/_mock/health';

export function HealthMedicationSection({
    open,
    onToggle,
    renderCollapseButton,
    fields,
    watch,
    setValue,
    onAdd,
    onRemove,
    isSubmitting,
}) {
    return (
        <Card>
            <CardHeader
                title="💊 Medicación"
                subheader="Medicamentos prescritos, dosis, horarios y responsables"
                action={renderCollapseButton(open, onToggle)}
                sx={{ mb: 3 }}
            />

            <Collapse in={open}>
                <Divider />

                <Stack spacing={3} sx={{ p: 3 }}>
                    <Typography variant="subtitle2">
                        ¿Toma algún medicamento actualmente?
                    </Typography>

                    <Field.RadioGroup
                        row
                        name="hasMedication"
                        options={MEDICATION_OPTIONS}
                        sx={{ gap: 4 }}
                    />

                    {watch('hasMedication') === 'yes' && (
                        <>
                            {fields.map((item, index) => (
                                <Box
                                    key={item.id}
                                    sx={{
                                        display: 'grid',
                                        gap: 2,
                                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                                    }}
                                >
                                    <RestrictedText
                                        label="Nombre del medicamento"
                                        value={watch(`medications.${index}.name`) || ''}
                                        onChange={(val) =>
                                            setValue(`medications.${index}.name`, val)
                                        }
                                        allow="all"
                                        maxLength={30}
                                    />

                                    <RestrictedText
                                        label="Dosis"
                                        value={watch(`medications.${index}.dose`) || ''}
                                        onChange={(val) =>
                                            setValue(`medications.${index}.dose`, val)
                                        }
                                        allow="all"
                                        maxLength={30}
                                    />

                                    <Field.Select
                                        name={`medications.${index}.schedule`}
                                        label="Horario"
                                        multiple
                                    >
                                        {MEDICATION_SCHEDULE_OPTIONS.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Field.Select>
                                </Box>
                            ))}

                            <Stack direction="row" spacing={2}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                                    onClick={onRemove}
                                >
                                    Eliminar último medicamento
                                </Button>

                                <Button
                                    variant="contained"
                                    startIcon={<Iconify icon="mingcute:add-line" />}
                                    onClick={onAdd}
                                    disabled={fields.length >= 5}
                                    sx={{ display: 'flex', gap: 1 }}
                                >
                                    <Box component="span">Agregar medicamento</Box>

                                    <Typography
                                        variant="caption"
                                        sx={{
                                            borderRadius: 1,
                                            fontWeight: 800,
                                            color: 'inherit',
                                        }}
                                    >
                                        {fields.length}/5
                                    </Typography>
                                </Button>
                            </Stack>
                        </>
                    )}

                    <Stack alignItems="flex-end">
                        <Button type="submit" variant="contained" loading={isSubmitting}>
                            Guardar cambios
                        </Button>
                    </Stack>
                </Stack>
            </Collapse>
        </Card>
    );
}
