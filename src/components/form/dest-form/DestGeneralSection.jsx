import { useParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { OPCIONES_ESTADO_DESTACAMENTO } from 'src/utils/estado-destacamento.mjs';
import { filtrarPorNombreComoElBuscador } from 'src/utils/buscador-organizacion.mjs';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import TimeInput from 'src/components/common/time-input';
import DaysSelect from 'src/components/common/days-select';
import NumberInput from 'src/components/common/number-input';

const nombreDelMiembro = (option) =>
    option?.fullName || `${option?.firstName || ''} ${option?.lastName || ''}`.trim();
const filtrarCoordinador = filtrarPorNombreComoElBuscador(nombreDelMiembro, (o) => o?.memberId);

export default function DestGeneralSection({
    isCreateView,
    members,
    churches,
    methods,
    watch,
    disabled = false,
    // El dia y la hora de reunion, el coordinador y el telefono los lleva el
    // propio Coordinador de Destacamento; el resto de la ficha, solo el
    // Administrador Global. Por eso van con su propio candado.
    scheduleDisabled = disabled,
    coordinatorDisabled = disabled,
    // El numero es de la Oficina Nacional, hasta al crear el destacamento.
    numberDisabled = disabled,
    numberMin = 11,
    numberMax = null,
    // El estado (Activo / Inactivo) no va en el formulario: vive en Firestore y
    // se guarda al elegirlo. Lo mueven solo el Administrador Global y la Oficina
    // Nacional (`puedeCambiarEstadoDeDestacamento`).
    estado,
    onEstadoChange,
    estadoDisabled = true,
}) {
    const params = useParams();
    const destId = params?.id;

    // Un miembro pertenece a este destacamento si su id de destacamento coincide
    // (se contemplan las distintas variantes del campo). En la vista de creacion
    // aun no hay destacamento, por lo que no se filtra.
    const normalizeId = (value) => String(value ?? '').trim();
    const belongsToDest = (member) =>
        [member?.destId, member?.idDestacamento, member?.destacamentoId].some(
            (value) => value !== undefined && value !== null && normalizeId(value) === normalizeId(destId)
        );
    const destMembers =
        destId && Array.isArray(members) ? members.filter(belongsToDest) : members || [];
    const membersCount = destMembers.length;
    return (
        <>
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

            <NameInput
                name="name"
                label="Nombre de Destacamento"
                maxLength={100}
                disabled={disabled}
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
                minValue={numberMin}
                maxValue={numberMax}
                disabled={numberDisabled}
                helperText={
                    numberDisabled ? 'Lo asigna la Oficina Nacional.' : ''
                }
            />

            <Field.Autocomplete
                name="churchId"
                label="Iglesia"
                disabled={disabled}
                options={Array.isArray(churches) ? churches : []}
                // El id no lo usa nadie para elegir una iglesia y ensuciaba el
                // campo: "Iglesia Aposento Alto, A.D. (ID: 263)".
                getOptionLabel={(option) => option?.name || ''}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                value={
                    Array.isArray(churches)
                        ? churches.find((c) => String(c.id) === String(watch('churchId'))) || null
                        : null
                }
                onChange={(_, value) => {
                    if (disabled) return;

                    methods.setValue('churchId', value?.id ? String(value.id) : '', {
                        shouldValidate: true,
                        shouldDirty: true,
                    });
                }}
            />

            <Field.Autocomplete
                name="coordinatorId"
                label="Coordinador de Destacamento"
                disabled={coordinatorDisabled}
                options={destMembers}
                // Como el buscador de la cabecera: palabras sueltas y erratas.
                filterOptions={filtrarCoordinador}
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
                    if (coordinatorDisabled) return;

                    methods.setValue('coordinatorId', value?.memberId ?? null, {
                        shouldValidate: true,
                        shouldDirty: true,
                    });
                }}
            />

            <DaysSelect
                name="destMeetingDays"
                label="Día de reunión"
                disabled={scheduleDisabled}
            />

            <TimeInput
                name="destMeetingTimes"
                label="Horarios de reunión"
                disabled={scheduleDisabled}
            />


            {!isCreateView && (
                <TextField
                    label="Cantidad de miembros"
                    value={membersCount}
                    fullWidth
                    disabled
                />
            )}

            {!isCreateView && (
                <TextField
                    select
                    label="Estado"
                    value={estado ?? 'activo'}
                    onChange={(event) => onEstadoChange?.(event.target.value)}
                    fullWidth
                    disabled={estadoDisabled}
                    // Cerrado se ve solo el nombre; la explicación va en la lista.
                    slotProps={{
                        select: {
                            renderValue: (valor) =>
                                OPCIONES_ESTADO_DESTACAMENTO.find((o) => o.value === valor)?.label ??
                                valor,
                        },
                    }}
                    helperText={
                        estadoDisabled
                            ? 'Lo cambian el Administrador Global y la Oficina Nacional.'
                            : ''
                    }
                >
                    {OPCIONES_ESTADO_DESTACAMENTO.map((opcion) => (
                        <MenuItem
                            key={opcion.value}
                            value={opcion.value}
                            sx={{ display: 'block', whiteSpace: 'normal', maxWidth: 360 }}
                        >
                            <Typography variant="body2">{opcion.label}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {opcion.descripcion}
                            </Typography>
                        </MenuItem>
                    ))}
                </TextField>
            )}

            {/* <Box
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
            </Box> */}
        </>
    );
}
