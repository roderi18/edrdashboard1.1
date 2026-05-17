'use client';

import { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

import { FlagIcon } from 'src/components/flag-icon';

// ----------------------------------------------------------------------

export default function CountrySelectApi({
    name = 'country',
    label = 'País',
    ...other
}) {
    const { control, setValue } = useFormContext();
    const [countries, setCountries] = useState([]);

    useEffect(() => {
        const loadCountries = async () => {
            const res = await fetch('/api/countries', { cache: 'no-store' });
            const data = await res.json();
            const list = data?.data || data?.Data || data;

            setCountries(Array.isArray(list) ? list : []);
        };

        loadCountries();
    }, []);

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => {
                const selected =
                    countries.find((c) => Number(c.id) === Number(field.value)) || null;

                return (
                    <Autocomplete
                        {...other}
                        options={countries}
                        value={selected}
                        getOptionLabel={(option) => option.label || ''}
                        isOptionEqualToValue={(option, value) =>
                            Number(option.id) === Number(value.id)
                        }
                        onChange={(_, newValue) => {
                            setValue(name, newValue?.id ? String(newValue.id) : '', {
                                shouldDirty: true,
                                shouldValidate: true,
                            });
                        }}

                        renderOption={(props, option) => {
                            const { key, ...rest } = props;

                            return (
                                <Box
                                    key={key}
                                    component="li"
                                    {...rest}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    <FlagIcon code={option.code} />
                                    {option.label}
                                </Box>
                            );
                        }}
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
