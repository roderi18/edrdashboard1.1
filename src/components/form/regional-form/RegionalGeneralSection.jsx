import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { useFormContext } from 'react-hook-form';
import NameInput from 'src/components/common/name-input';

import { Field } from 'src/components/hook-form';
import CountrySelectApi from 'src/components/api/CountrySelectApi';

export default function RegionalGeneralSection({
    isCreateView,
    methods,
    watch,
}) {
    const { setValue } = useFormContext();
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