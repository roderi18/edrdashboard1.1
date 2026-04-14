import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { useFormContext } from 'react-hook-form';
import NameInput from 'src/components/common/name-input';
import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import AutocompleteWithCreate from 'src/components/common/autocomplete-with-create';
import { Field } from 'src/components/hook-form';
import CountrySelectApi from 'src/components/api/country-select-api';

export default function RegionalGeneralSection({
    isCreateView,
    methods,
    watch,
}) {
    const { setValue } = useFormContext();
    const [members, setMembers] = useState([]);

    useEffect(() => {
        const load = async () => {
            const res = await fetch('/api/members');
            const data = await res.json();
            setMembers(data?.Data || []);
        };

        load();
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
                    Información de la Región
                </Typography>

                <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
            </Box>

            {/* CAMPOS */}
            <NameInput
                name="name"
                label="Nombre de la Región"
            />

            {!isCreateView && (
                <Field.Text name="regionId" label="ID de Región" disabled />
            )}

            <AutocompleteWithCreate
                options={members}
                value={
                    members.find(
                        (m) => String(m.idMiembros) === String(watch('directorId'))
                    ) || null
                }
                onChange={(_, newValue) => {
                    setValue('directorId', newValue?.idMiembros || '');
                }}
                getOptionLabel={(option) =>
                    `${option?.nombres || ''} ${option?.apellidos || ''}`
                }
                isOptionEqualToValue={(option, value) =>
                    String(option.idMiembros) === String(value.idMiembros)
                }
                label="Director"
                createLabel="Crear Director"
                createLink="/dashboard/level/member/new"
            />
            <CountrySelectApi name="countryId" label="País" />

            {!isCreateView && (
                <TextField
                    label="Secciones"
                    value={methods.getValues('regionalXSectionalCount') || 0}
                    fullWidth
                    disabled
                />
            )}

            {!isCreateView && (
                <TextField
                    label="Destacamentos"
                    value={watch('regionalXSectionalXDestCount') || 0}
                    fullWidth
                    disabled
                />
            )}

            {!isCreateView && (
                <TextField
                    label="Miembros"
                    value={watch('regionalXSectionalMemberCount') || 0}
                    fullWidth
                    disabled
                />
            )}
        </>
    );
}