'use client';

import { Controller, useFormContext } from 'react-hook-form';

import { FlagIcon } from 'src/components/flag-icon';
import { countries } from 'src/assets/data/countries';

import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';

// ----------------------------------------------------------------------

export default function CountrySelectApi({
    name = 'country',
    label = 'País',
    ...other
}) {
    const { control, setValue } = useFormContext();

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => {
                const selected =
                    countries.find((c) => c.label === field.value) || null;

                return (
                    <Autocomplete
                        {...other}
                        options={countries}
                        value={selected}
                        getOptionLabel={(option) => option.label || ''}
                        isOptionEqualToValue={(option, value) =>
                            option.label === value.label
                        }
                        onChange={(_, newValue) => {
                            setValue(name, newValue?.label || '');
                        }}

                        // 🔥 EXACTO estilo MEMBERS
                        renderOption={(props, option) => (
                            <Box
                                component="li"
                                {...props}
                                key={option.code}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <FlagIcon code={option.code}
                                />
                                {option.label}
                            </Box>
                        )}

                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={label}
                                error={!!error}
                                helperText={error?.message}
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: selected ? (
                                        <Box sx={{ mr: 1, display: 'flex' }}>
                                            <FlagIcon code={selected.code} />
                                        </Box>
                                    ) : null,
                                }}
                            />
                        )}
                    />
                );
            }}
        />
    );
}