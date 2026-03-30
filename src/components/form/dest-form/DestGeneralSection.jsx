import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { Field } from 'src/components/hook-form';
import { useParams } from 'next/navigation';
export default function DestGeneralSection({
    isCreateView,
    members,
    churches,
    methods,
    watch,
}) {
    const params = useParams();
    const destId = params?.id;
    const membersCount = members?.filter(
        (m) => m.destId === destId
    )?.length || 0;
    return (
        <>
            {(
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
                options={Array.isArray(members) ? members : []}
                value={members.find((m) => m.memberId === watch('coordinatorId')) || null}
                getOptionLabel={(option) =>
                    option?.fullName || `${option?.firstName || ''} ${option?.lastName || ''}`
                }
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                onChange={(_, value) => {
                    methods.setValue('coordinatorId', value?.memberId ?? null, {
                        shouldValidate: true,
                        shouldDirty: true,
                    });
                }}
            />

            <Field.CountrySelect
                name="country"
                label="País"
                placeholder="Elige un país"
            />


            <Field.Text name="destMeetingDays" label="Días de reunión" />
            <Field.Text name="destMeetingTimes" label="Horarios de reunión" />

            {!isCreateView && (
                <TextField
                    label="Cantidad de miembros"
                    value={membersCount}
                    fullWidth
                    disabled
                />
            )}
        </>
    );
}