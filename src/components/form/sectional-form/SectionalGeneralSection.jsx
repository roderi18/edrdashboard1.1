'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { getRegionals } from 'src/services/regional-service';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import LocationSuggestInput from 'src/components/api/location-suggest-input-api';
import DirectivaMemberSelect from 'src/components/form/common/directiva-member-select';
// ----------------------------------------------------------------------

export default function SectionalGeneralSection({
    methods,
    watch,
    isCreateView,
    disabled = false,
    lockedRegional = null,
    // Ningun cargo de seccion mueve su seccion de region. Ver
    // `puedeAsignarLaRegionDeUnaSeccion`.
    regionBloqueada = false,
}) {
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

            {/* Nombre principal y nombre 2. El principal es el que guarda la API
                de Secciones; el segundo —el apodo con el que se la conoce, "Tiburones
                Del Este"— no cabe ahi y se guarda en Firebase con el id de la seccion.
                `allowSpecialChars` abre parentesis y puntos, ademas de "#" y "/". */}
            <LocationSuggestInput
                name="sectionalName"
                label="Nombre Principal de Sección"
                allowNumbers
                allowDash
                allowSpecialChars
                disabled={disabled}
            />

            <NameInput
                name="sectionalName2"
                label="Nombre secundario de Sección"
                allowNumbers
                allowDash
                allowSpecialChars
                disabled={disabled}
            />

            {/* Responsable de la sección. Va al lado del nombre, como el
                Coordinador en el destacamento. */}
            <DirectivaMemberSelect
                label="Coordinador Seccional"
                disabled={disabled}
                value={watch('directorId')}
                onChange={(idMiembro) =>
                    methods.setValue('directorId', idMiembro ?? null, {
                        shouldDirty: true,
                    })
                }
                helperText="El cambio lo aprueba la Oficina Nacional."
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

            {/* Región: bloqueada a la región propia del coordinador regional, y
                cerrada del todo para los cargos de sección —una sección no se muda
                de región por decisión de quien la coordina—. En vez de un
                desplegable muerto se muestra la región que tiene, que es lo que
                de verdad se quiere saber ahí. */}
            {lockedRegional || regionBloqueada ? (
                <TextField
                    label="Región"
                    value={
                        lockedRegional?.name ||
                        lockedRegional?.regionalName ||
                        regionals.find((r) => String(r.regionId) === String(regionalId))?.name ||
                        ''
                    }
                    disabled
                    fullWidth
                    helperText={
                        regionBloqueada && !lockedRegional
                            ? 'La región de una sección no se cambia desde aquí.'
                            : undefined
                    }
                />
            ) : (
                <Field.Autocomplete
                    name="regionalId"
                    label="Región"
                    disabled={disabled}
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
            )}
        </>
    );
}
