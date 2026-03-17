import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';

import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';

import {
    MEMBER_OCUPATIONS_SORTED,
    MEMBER_GENDERS,
    MEMBER_SHIRT_SIZES,
    NATIONAL_LEADERSHIP_LEVELS,
} from 'src/sections/member/member-create-edit-options';

import { getDests } from 'src/services/dest-service';
import { _leadershipRolesByLevel } from 'src/_mock/_leadership';

export default function MemberLeadershipAndOtherSection({
    watch,
    methods,
    isCreateView,
    isEdit,
}) {
    const selectedNationalLevel = watch('nationalLeadershipLevel');

    const Content = (
        <Box
            sx={{
                gridColumn: '1 / -1',
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
            }}
        >
            {/* Ocupación */}
            <Field.Autocomplete
                name="ocupation"
                label="Ocupación"
                options={MEMBER_OCUPATIONS_SORTED}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.label || ''
                }
                isOptionEqualToValue={(option, value) => option.value === value?.value}
                ListboxProps={{ sx: { maxHeight: 260 } }}
            />

            {/* Liderazgo Nacional */}
            {isCreateView && (
                <>
                    <Field.Select
                        name="nationalLeadershipLevel"
                        label="Posición en Consejo Nacional"
                        value={watch('nationalLeadershipLevel') ?? ''}
                    >
                        {NATIONAL_LEADERSHIP_LEVELS.map((option) => (
                            <MenuItem key={option.label} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Field.Select>

                    {selectedNationalLevel !== 'none' && (
                        <Field.Select name="nationalLeadershipRole" label="Cargo">
                            {_leadershipRolesByLevel[selectedNationalLevel]?.map((role) => (
                                <MenuItem key={role.value} value={role.value}>
                                    {role.label}
                                </MenuItem>
                            ))}
                        </Field.Select>
                    )}
                </>
            )}

            {/* Destacamento */}
            <Field.Autocomplete
                name="destId"
                label="Tu Destacamento"
                options={DESTS}
                freeSolo={false}
                value={DESTS.find((d) => d.id === watch('destId')) || null}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.name || ''
                }
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                onChange={(event, option) => {
                    methods.setValue('destId', option?.id || '');
                }}
            />

            {/* Posición en destacamento */}
            <Field.Autocomplete
                name="memberPosition"
                value={
                    [{ value: 'none', label: 'Ninguna' }, ..._leadershipRolesByLevel.dest]
                        .find((r) => r.value === watch('memberPosition')) || null
                }
                label="Nivel posición en tu Destacamento"
                options={[
                    { value: 'none', label: 'Ninguna' },
                    ..._leadershipRolesByLevel.dest,
                ]}
                freeSolo={false}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.label || ''
                }
                isOptionEqualToValue={(option, value) =>
                    option.value === value?.value
                }
                onChange={(event, option) =>
                    methods.setValue('memberPosition', option?.value || 'none')
                }
            />

            {/* Sexo */}
            <Field.Autocomplete
                name="gender"
                label="Sexo"
                options={MEMBER_GENDERS}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.label || ''
                }
                isOptionEqualToValue={(option, value) =>
                    option.value === value?.value
                }
            />

            {/* T-shirt */}
            <Field.Select name="shirtSize" label="Size T-Shirt">
                {MEMBER_SHIRT_SIZES.map((size) => (
                    <MenuItem key={size.value} value={size.value}>
                        {size.label}
                    </MenuItem>
                ))}
            </Field.Select>
        </Box>
    );

    if (!isEdit) {
        return Content;
    }

    return (
        <Accordion
            sx={{
                gridColumn: '1 / -1',
                boxShadow: 'none',
                border: (theme) => `1px dashed ${theme.palette.divider}`,
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary
                expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={20} />}
            >
                <Typography
                    sx={{
                        typography: 'subtitle2',
                        color: 'text.secondary',
                    }}
                >
                    Destacamento, posición, otros..
                </Typography>
            </AccordionSummary>

            <AccordionDetails>{Content}</AccordionDetails>
        </Accordion>
    );
}