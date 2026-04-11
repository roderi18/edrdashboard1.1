import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { Field } from 'src/components/hook-form';
import { useParams } from 'next/navigation';
import NameInput from 'src/components/common/name-input';
import NumberInput from 'src/components/common/number-input';
import DaysSelect from 'src/components/common/days-select';
import TimeInput from 'src/components/common/time-input';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

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

            <NameInput
                name="name"
                label="Nombre de Destacamento"
                maxLength={100}
            // InputProps={{
            //     startAdornment: (
            //         <InputAdornment position="start">
            //             Destacamento
            //         </InputAdornment>
            //     ),
            // }}
            />

            <NumberInput
                name="destNumber"
                label="Número de Destacamento"
                maxLength={3}
            />

            <Field.Autocomplete
                name="churchId"
                label="Iglesia"
                options={Array.isArray(churches) ? churches : []}
                getOptionLabel={(option) =>
                    option?.name ? `${option.name} (ID: ${option.id})` : ''
                }
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                value={
                    Array.isArray(churches)
                        ? churches.find((c) => String(c.id) === String(watch('churchId'))) || null
                        : null
                }
                onChange={(_, value) => {
                    methods.setValue('churchId', value?.id ? String(value.id) : '', {
                        shouldValidate: true,
                        shouldDirty: true,
                    });
                }}
            />

            <Field.Autocomplete
                name="coordinatorId"
                label="Coordinador de Destacamento"
                options={Array.isArray(members) ? members : []}
                value={
                    watch('coordinatorId')
                        ? members.find((m) => m.memberId === watch('coordinatorId')) || null
                        : null
                }
                getOptionLabel={(option) =>
                    option?.fullName || `${option?.firstName || ''} ${option?.lastName || ''}`.trim()
                }
                isOptionEqualToValue={(option, value) => option.memberId === value?.memberId}
                onChange={(_, value) => {
                    methods.setValue('coordinatorId', value?.memberId ?? null, {
                        shouldValidate: true,
                        shouldDirty: true,
                    });
                }}
            />

            <DaysSelect
                name="destMeetingDays"
                label="Día de reunión"
            />

            <TimeInput
                name="destMeetingTimes"
                label="Horarios de reunión"
            />


            {!isCreateView && (
                <TextField
                    label="Cantidad de miembros"
                    value={membersCount}
                    fullWidth
                    disabled
                />
            )}

            <Box
                sx={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    mt: 2,
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
                    Otras informaciones
                </Typography>

                <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />


            </Box>
            <FormControlLabel
                control={
                    <Switch
                        checked={watch('registradoOfnc') ?? true}
                        onChange={(e) =>
                            methods.setValue('registradoOfnc', e.target.checked, {
                                shouldValidate: true,
                                shouldDirty: true,
                            })
                        }
                    />
                }
                label="Registrado en Oficina Nacional?"
            />

            <FormControlLabel
                control={
                    <Switch
                        checked={watch('rritrackActivo') ?? true}
                        onChange={(e) =>
                            methods.setValue('rritrackActivo', e.target.checked, {
                                shouldValidate: true,
                                shouldDirty: true,
                            })
                        }
                    />
                }
                label="RRITrack activo?"
            />
        </>
    );
}