'use client';

import { Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
    FOOD_ALLERGY_OPTIONS,
    ALLERGY_REACTION_OPTIONS,
    ENVIRONMENTAL_ALLERGY_OPTIONS,
} from 'src/_mock/health';

import { Field } from 'src/components/hook-form';
import RestrictedText from 'src/components/restricted/RestrictedText';

import { HealthSectionSubmit } from 'src/sections/member/health/componentes/HealthSectionSubmit';

export function HealthAllergiesSection({
    open,
    onToggle,
    renderCollapseButton,
    methods,
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
                title="🚨 Alergias"
                subheader="Alergias alimentarias, medicamentosas y ambientales"
                action={renderCollapseButton(open, onToggle)}
                sx={{ mb: 3 }}
            />

            <Collapse in={open}>
                <Divider />

                <Stack spacing={3} sx={{ p: 3 }}>
                    {/* ¿TIENE ALERGIAS? */}
                    <Stack spacing={1}>
                        {!readOnly && (
                            <Typography variant="subtitle2">
                                ¿Presenta alguna alergia?
                            </Typography>
                        )}

                        {!readOnly && (
                            <Field.RadioGroup
                                row
                                name="hasAllergies"
                                options={[
                                    { label: 'No', value: 'no' },
                                    { label: 'Sí', value: 'yes' },
                                ]}
                                sx={{ gap: 4 }}
                            />
                        )}
                    </Stack>

                    {readOnly && watch('hasAllergies') !== 'yes' && (
                        <Typography variant="body2" color="text.secondary">
                            Sin información registrada.
                        </Typography>
                    )}

                    {watch('hasAllergies') === 'yes' && (
                        <>
                            {/* 💊 ALERGIAS A MEDICAMENTOS */}
                            <Typography variant="subtitle2">
                                💊 Alergias a medicamentos
                            </Typography>

                            {!readOnly && (
                                <Field.RadioGroup
                                    row
                                    name="drugAllergy"
                                    options={[
                                        { label: 'No', value: 'no' },
                                        { label: 'Sí', value: 'yes' },
                                    ]}
                                    sx={{ gap: 4 }}
                                />
                            )}

                            {readOnly && watch('drugAllergy') !== 'yes' && (
                                <Typography variant="body2" color="text.secondary">
                                    Sin información registrada.
                                </Typography>
                            )}

                            {watch('drugAllergy') === 'yes' && (
                                <RestrictedText
                                    label="Indique el medicamento"
                                    value={watch('drugAllergyDetails') || ''}
                                    onChange={(val) => setValue('drugAllergyDetails', val)}
                                    allow="all"
                                    maxLength={50}
                                    readOnly={readOnly}
                                    disabled={readOnly}
                                />
                            )}

                            {/* 🥜 ALERGIAS ALIMENTARIAS */}
                            <Divider />
                            <Typography variant="subtitle2">
                                🥜 Alergias alimentarias
                            </Typography>

                            {!readOnly && (
                                <Field.RadioGroup
                                    row
                                    name="hasFoodAllergies"
                                    options={[
                                        { label: 'No', value: 'no' },
                                        { label: 'Sí', value: 'yes' },
                                    ]}
                                    sx={{ gap: 4 }}
                                />
                            )}

                            {readOnly && watch('hasFoodAllergies') !== 'yes' && (
                                <Typography variant="body2" color="text.secondary">
                                    Sin información registrada.
                                </Typography>
                            )}

                            {watch('hasFoodAllergies') === 'yes' && (
                                <>
                                    {readOnly ? (
                                        <Typography variant="body2" color="text.secondary">
                                            {FOOD_ALLERGY_OPTIONS
                                                .filter((option) =>
                                                    watch('foodAllergies')?.includes(option.value)
                                                )
                                                .map((option) => option.label)
                                                .join(', ') || 'Sin información registrada.'}
                                        </Typography>
                                    ) : (
                                        <Controller
                                            name="foodAllergies"
                                            control={methods.control}
                                            defaultValue={[]}
                                            render={({ field }) => (
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: {
                                                            xs: '1fr 1fr',
                                                            md: 'repeat(4, 1fr)',
                                                        },
                                                        columnGap: 4,
                                                        rowGap: 1,
                                                    }}
                                                >
                                                    {FOOD_ALLERGY_OPTIONS.map((option) => (
                                                        <FormControlLabel
                                                            key={option.value}
                                                            label={option.label}
                                                            control={
                                                                <Checkbox
                                                                    checked={field.value.includes(
                                                                        option.value
                                                                    )}
                                                                    onChange={(e) => {
                                                                        field.onChange(
                                                                            e.target.checked
                                                                                ? [
                                                                                      ...field.value,
                                                                                      option.value,
                                                                                  ]
                                                                                : field.value.filter(
                                                                                      (v) =>
                                                                                          v !==
                                                                                          option.value
                                                                                  )
                                                                        );
                                                                    }}
                                                                />
                                                            }
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                        />
                                    )}

                                    {watch('foodAllergies')?.includes('other') && (
                                        <RestrictedText
                                            label="Especifique otros alimentos"
                                            value={watch('foodAllergyOther') || ''}
                                            onChange={(val) =>
                                                setValue('foodAllergyOther', val)
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

                            {/* 🌿 ALERGIAS AMBIENTALES */}
                            <Divider />
                            <Typography variant="subtitle2">
                                🌿 Alergias ambientales
                            </Typography>

                            {!readOnly && (
                                <Field.RadioGroup
                                    row
                                    name="hasEnvironmentalAllergies"
                                    options={[
                                        { label: 'No', value: 'no' },
                                        { label: 'Sí', value: 'yes' },
                                    ]}
                                    sx={{ gap: 4 }}
                                />
                            )}

                            {readOnly && watch('hasEnvironmentalAllergies') !== 'yes' && (
                                <Typography variant="body2" color="text.secondary">
                                    Sin información registrada.
                                </Typography>
                            )}

                            {watch('hasEnvironmentalAllergies') === 'yes' && (
                                <>
                                    {readOnly ? (
                                        <Typography variant="body2" color="text.secondary">
                                            {ENVIRONMENTAL_ALLERGY_OPTIONS
                                                .filter((option) =>
                                                    watch('environmentalAllergies')?.includes(
                                                        option.value
                                                    )
                                                )
                                                .map((option) => option.label)
                                                .join(', ') || 'Sin información registrada.'}
                                        </Typography>
                                    ) : (
                                        <Controller
                                            name="environmentalAllergies"
                                            control={methods.control}
                                            defaultValue={[]}
                                            render={({ field }) => (
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: {
                                                            xs: '1fr 1fr',
                                                            md: 'repeat(4, 1fr)',
                                                        },
                                                        columnGap: 4,
                                                        rowGap: 1,
                                                    }}
                                                >
                                                    {ENVIRONMENTAL_ALLERGY_OPTIONS.map((option) => (
                                                        <FormControlLabel
                                                            key={option.value}
                                                            label={option.label}
                                                            control={
                                                                <Checkbox
                                                                    checked={field.value.includes(
                                                                        option.value
                                                                    )}
                                                                    onChange={(e) => {
                                                                        field.onChange(
                                                                            e.target.checked
                                                                                ? [
                                                                                      ...field.value,
                                                                                      option.value,
                                                                                  ]
                                                                                : field.value.filter(
                                                                                      (v) =>
                                                                                          v !==
                                                                                          option.value
                                                                                  )
                                                                        );
                                                                    }}
                                                                />
                                                            }
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                        />
                                    )}

                                    {watch('environmentalAllergies')?.includes('other') && (
                                        <RestrictedText
                                            label="Especifique otros alérgenos ambientales"
                                            value={watch('environmentalAllergyOther') || ''}
                                            onChange={(val) =>
                                                setValue('environmentalAllergyOther', val)
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

                            {/* 🚑 TIPO DE REACCIÓN */}
                            <Divider />

                            <Field.Select
                                name="allergyReaction"
                                label="Tipo de reacción"
                                disabled={readOnly}
                            >
                                {ALLERGY_REACTION_OPTIONS.map((option) => (
                                    <MenuItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Field.Select>
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
