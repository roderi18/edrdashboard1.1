import { useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import CountrySelectApi from 'src/components/api/country-select-api';
import DirectivaMemberSelect from 'src/components/form/common/directiva-member-select';

export default function RegionalGeneralSection({
    isCreateView,
    disabled = false,
}) {
    const { setValue, watch } = useFormContext();
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
                disabled={disabled}
            />

            {/* Responsable de la región, al lado del nombre.
                Sustituye al antiguo selector "Director": hace lo mismo y ademas
                muestra que cargo ocupa ya cada persona y avisa de que se le
                desvincula. Tener dos controles sobre `directorId` los enfrentaba. */}
            <DirectivaMemberSelect
                label="Director Regional"
                disabled={disabled}
                value={watch('directorId')}
                onChange={(idMiembro) => {
                    setValue('directorId', idMiembro ?? null, { shouldDirty: true });
                    // Se conserva del selector anterior: el Director lleva su cargo
                    // institucional.
                    setValue('idCargoInstitucional', idMiembro ? 1 : null);
                }}
            />

            {!isCreateView && (
                <Field.Text name="regionId" label="ID de Región" disabled />
            )}

            <CountrySelectApi name="countryId" label="País" disabled={disabled} />

            {!isCreateView && (
                <Field.Text
                    name="regionalXSectionalCount"
                    label="Secciones"
                    disabled
                />
            )}

            {!isCreateView && (
                <Field.Text
                    name="regionalXSectionalXDestCount"
                    label="Destacamentos"
                    disabled
                />
            )}

            {!isCreateView && (
                <Field.Text
                    name="regionalXSectionalMemberCount"
                    label="Miembros"
                    disabled
                />
            )}
        </>
    );
}
