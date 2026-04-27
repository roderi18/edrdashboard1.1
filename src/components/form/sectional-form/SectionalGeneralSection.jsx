'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { getRegionals } from 'src/services/regional-service';

import { Field } from 'src/components/hook-form';
import LocationSuggestInput from 'src/components/api/location-suggest-input-api';
// ----------------------------------------------------------------------

export default function SectionalGeneralSection({ methods, watch, isCreateView }) {
    const [regionals, setRegionals] = useState([]);
    const regionalId = watch('regionalId');

    useEffect(() => {
        const loadRegionals = async () => {
            const data = await getRegionals();

            const unique = Array.from(
                new Map(data.map((item) => [item.regionId, item])).values()
            );

            const prepared = unique.map((item) => ({
                ...item,
                name: item.name || `Región ${item.regionId}`, // limpio
                label: `${item.name || 'Región'}-${item.regionId}`, // 👈 clave única interna
            }));

            setRegionals(prepared);
        };

        loadRegionals();
    }, []);

    return (
        <>
            {/* HEADER */}
            <Box
                sx={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    mb: 1,
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
                    Información de la Sección
                </Typography>

                <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
            </Box>

            {/* Nombre de la Sección */}
            <LocationSuggestInput
                name="sectionalName"
                label="Nombre de la Sección"
                allowNumbers
                allowDash
            />

            {/* ID de la Sección */}
            {!isCreateView && (
                <Field.Text
                    name="idSeccion"
                    label="ID de Sección"
                    disabled
                />
            )}

            {/* Destacamentos */}
            {!isCreateView && (
                <Field.Text
                    name="sectionalDestCount"
                    label="Cantidad de destacamentos"
                    disabled
                />
            )}

            {/* Miembros */}
            {!isCreateView && (
                <Field.Text
                    name="sectionalXDestMemberCount"
                    label="Cantidad de miembros"
                    disabled
                />
            )}

            {/* Región (Autocomplete dinámico) */}
            <Field.Autocomplete
                name="regionalId"
                label="Región"
                options={regionals}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option?.name || ''
                }
                renderOption={(props, option) => (
                    <li {...props} key={option.regionId}>
                        {option.name}
                    </li>
                )}
                isOptionEqualToValue={(option, value) =>
                    option.regionId === value?.regionId
                }
                value={
                    regionals.find((r) => String(r.regionId) === regionalId) || null
                }
                onChange={(event, option) => {
                    methods.setValue('regionalId', option?.regionId?.toString() || '', {
                        shouldDirty: true,
                        shouldValidate: true,
                    });
                }}
            />
        </>
    );
}
