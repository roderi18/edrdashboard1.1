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
                        <Typography variant="subtitle2">
                            ¿Presenta alguna alergia?
                        </Typography>

                        <Field.RadioGroup
                            row
                            name="hasAllergies"
                            options={[
                                { label: 'No', value: 'no' },
                                { label: 'Sí', value: 'yes' },
                            ]}
                            sx={{ gap: 4 }}
                        />
                    </Stack>

                    {watch('hasAllergies') === 'yes' && (
                        <>
                            {/* 💊 ALERGIAS A MEDICAMENTOS */}
                            <Divider />
                            <Typography variant="subtitle2">
                                💊 Alergias a medicamentos
                            </Typography>

                            <Field.RadioGroup
                                row
                                name="drugAllergy"
                                options={[
                                    { label: 'No', value: 'no' },
                                    { label: 'Sí', value: 'yes' },
                                ]}
                                sx={{ gap: 4 }}
                            />

                            {watch('drugAllergy') === 'yes' && (
                                <RestrictedText
                                    label="Indique el medicamento"
                                    value={watch('drugAllergyDetails') || ''}
                                    onChange={(val) => setValue('drugAllergyDetails', val)}
                                    allow="all"
                                    maxLength={50}
                                />
                            )}

                            {/* 🥜 ALERGIAS ALIMENTARIAS */}
                            <Divider />
                            <Typography variant="subtitle2">
                                🥜 Alergias alimentarias
                            </Typography>

                            <Field.RadioGroup
                                row
                                name="hasFoodAllergies"
                                options={[
                                    { label: 'No', value: 'no' },
                                    { label: 'Sí', value: 'yes' },
                                ]}
                                sx={{ gap: 4 }}
                            />

                            {watch('hasFoodAllergies') === 'yes' && (
                                <>
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
                                                                checked={field.value.includes(option.value)}
                                                                onChange={(e) => {
                                                                    field.onChange(
                                                                        e.target.checked
                                                                            ? [...field.value, option.value]
                                                                            : field.value.filter(
                                                                                (v) => v !== option.value
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
                                        />
                                    )}
                                </>
                            )}

                            {/* 🌿 ALERGIAS AMBIENTALES */}
                            <Divider />
                            <Typography variant="subtitle2">
                                🌿 Alergias ambientales
                            </Typography>

                            <Field.RadioGroup
                                row
                                name="hasEnvironmentalAllergies"
                                options={[
                                    { label: 'No', value: 'no' },
                                    { label: 'Sí', value: 'yes' },
                                ]}
                                sx={{ gap: 4 }}
                            />

                            {watch('hasEnvironmentalAllergies') === 'yes' && (
                                <>
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
                                                                checked={field.value.includes(option.value)}
                                                                onChange={(e) => {
                                                                    field.onChange(
                                                                        e.target.checked
                                                                            ? [...field.value, option.value]
                                                                            : field.value.filter(
                                                                                (v) => v !== option.value
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
                                        />
                                    )}
                                </>
                            )}

                            {/* 🚑 TIPO DE REACCIÓN */}
                            <Divider />

                            <Field.Select
                                name="allergyReaction"
                                label="Tipo de reacción"
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

                    <HealthSectionSubmit
                        isSubmitting={isSubmitting}
                        isGroupLeader={isGroupLeader}
                        sendingApproval={sendingApproval}
                        onRequestApproval={onRequestApproval}
                    />
                </Stack>
            </Collapse>
        </Card>
    );
}
