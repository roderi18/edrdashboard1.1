import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { nombreDeMiembro, buscarMiembroConCorreo } from 'src/utils/member-correo-duplicado';

import { getMembers } from 'src/services/member-service';

import { Field } from 'src/components/hook-form';
import NameInput from 'src/components/common/name-input';
import { MaskedField } from 'src/components/masked-field';

export default function MemberGeneralSection({
    age,
    division,
    isCreateView,
    control,
    minBirthdate,
    maxBirthdate,
    masked = false,
    // La fecha de nacimiento se enmascara por separado: algunos cargos ven la
    // ficha enmascarada pero conservan visible la fecha (edad y division).
    maskBirthdate = masked,
    readOnly = false,
    // Id del miembro que se esta editando, para no confundirlo consigo mismo al
    // comprobar si su correo esta repetido.
    memberId = null,
}) {
    const { setError, clearErrors } = useFormContext();
    const [comprobandoCorreo, setComprobandoCorreo] = useState(false);

    // Se comprueba al salir del campo, no solo al guardar: asi se entera antes de
    // seguir llenando el resto de la ficha.
    const revisarCorreoAlSalir = async (evento) => {
        const correo = String(evento.target.value || '').trim();

        clearErrors('email');

        if (!correo) return;

        setComprobandoCorreo(true);

        try {
            const duplicado = buscarMiembroConCorreo(
                await getMembers().catch(() => []),
                correo,
                memberId
            );

            if (duplicado) {
                setError('email', {
                    type: 'manual',
                    message: `Ese correo ya lo usa ${nombreDeMiembro(duplicado)}.`,
                });
            }
        } finally {
            setComprobandoCorreo(false);
        }
    };

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
                        Información general
                    </Typography>

                    <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                </Box>
            )}

            <NameInput
                name="firstName"
                label="Nombres"
                maxLength={60}
                disabled={readOnly}
            />

            <NameInput
                name="lastName"
                label="Apellidos"
                maxLength={60}
                disabled={readOnly}
            />

            {maskBirthdate ? (
                <MaskedField
                    label={`Fecha de nacimiento${age !== null ? ` (${age} años)` : ''}`}
                    preset="date"
                />
            ) : (
                <Field.DatePicker
                    name="birthdate"
                    label={`Fecha de nacimiento${age !== null ? ` (${age} años)` : ''
                        }`}
                    format="DD/MM/YYYY"
                    views={['year', 'month', 'day']}
                    minDate={minBirthdate}
                    maxDate={maxBirthdate}
                    disabled={readOnly}
                />
            )}

            <Field.Text
                name="memberDivision"
                label="División (cálculo automático según edad)"
                value={division || ''}
                disabled
            />

            {masked ? (
                <MaskedField label="Núm. Teléfono" preset="phone" />
            ) : (
                <Controller
                    name="phoneNumber"
                    control={control}
                    render={({ field }) => (
                        <Field.Phone
                            {...field}
                            label="Núm. Teléfono"
                            defaultCountry="DO"
                            disabled={readOnly}
                            inputProps={{ maxLength: 14 }}
                        />
                    )}
                />
            )}

            {masked ? (
                <MaskedField label="Correo electrónico" preset="text" />
            ) : (
                <Field.Text
                    name="email"
                    label="Correo electrónico"
                    disabled={readOnly}
                    onBlur={revisarCorreoAlSalir}
                    helperText={comprobandoCorreo ? 'Comprobando el correo…' : undefined}
                />
            )}
        </>
    );
}
