import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { Field } from 'src/components/hook-form';

export default function DestGeneralSection({
    isCreateView,
    members,
    churches,
    methods,
    watch,
}) {
    return (
        <>
            {isCreateView && (
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
                        Información del destacamento
                    </Typography>

                    <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                </Box>
            )}

            <Field.Text name="name" label="Nombre de Destacamento" />

            <Field.Text
                name="destNumber"
                label="Número de Destacamento"
                inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                }}
            />

            <Field.Autocomplete
                name="coordinatorId"
                label="Coordinador de Destacamento"
                options={members}
                value={members.find((m) => m.id === watch('coordinatorId')) || null}
                getOptionLabel={(option) =>
                    option?.fullName || `${option?.firstName || ''} ${option?.lastName || ''}`
                }
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                onChange={(_, value) =>
                    methods.setValue('coordinatorId', value?.id ?? null)
                }
            />

            <Field.CountrySelect
                name="country"
                label="País"
                placeholder="Elige un país"
            />

            <Field.Autocomplete
                name="churchId"
                label="Iglesia a la que pertenece"
                options={churches}
                value={churches.find((c) => c.id === watch('churchId')?.id) || null}
                getOptionLabel={(option) => option?.name || ''}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                onChange={(_, value) =>
                    methods.setValue('churchId', value || null)
                }
            />

            <Field.Text name="destMeetingTimes" label="Horarios de reunión" />
        </>
    );
}