import { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { getSectionals } from 'src/services/sectional-service';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import LocationSelect from 'src/components/location/location-select';

export default function ChurchDestSection({
    isCreateView,
    methods,
    disabled = false,
}) {
    const [sectionals, setSectionals] = useState([]);
    const { watch, setValue, control } = useFormContext();

    useEffect(() => {
        const loadSectionals = async () => {
            const data = await getSectionals();
            setSectionals(Array.isArray(data) ? data : []);
        };

        loadSectionals();
    }, []);

    return (
        <Box>
            {/* HEADER */}
            <Box
                sx={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    mb: 2,
                }}
            >
                <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />

                <Typography
                    sx={{
                        mx: 2,
                        typography: 'subtitle2',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Información de la Iglesia
                </Typography>

                <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
            </Box>

            {/* CAMPOS */}
            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                }}
            >
                <NameInput
                    name="churchName"
                    label="Nombre de Iglesia"
                    maxLength={100}
                    allowNumbers
                    disabled={disabled}
                />

                <NameInput
                    name="pastor"
                    label="Pastor"
                    maxLength={100}
                    disabled={disabled}
                />

                <Controller
                    name="telefono"
                    control={control}
                    render={({ field }) => (
                        <Field.Phone
                            {...field}
                            label="Teléfono"
                            defaultCountry="DO"
                            disabled={disabled}
                            inputProps={{ maxLength: 14 }}
                        />
                    )}
                />

                <LocationSelect disabled={disabled} />

                <Field.Text
                    name="correo"
                    label="Correo"
                    type="email"
                    disabled={disabled}
                />


                <Field.Autocomplete
                    name="sectionId"
                    label="Sección"
                    disabled={disabled}
                    options={sectionals}
                    getOptionLabel={(option) =>
                        typeof option === 'string'
                            ? option
                            : option?.sectionalName || ''
                    }
                    isOptionEqualToValue={(option, value) =>
                        option.id === value?.id
                    }
                    value={
                        sectionals.find(
                            (s) => String(s.id) === watch('sectionId')
                        ) || null
                    }
                    onChange={(event, option) => {
                        if (disabled) return;

                        setValue(
                            'sectionId',
                            option?.id ? String(option.id) : '',
                            {
                                shouldValidate: true,
                                shouldDirty: true,
                            }
                        );
                    }}
                />
            </Box>
        </Box>
    );
}
