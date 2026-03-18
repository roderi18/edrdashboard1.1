import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { Controller } from 'react-hook-form';
import { Field } from 'src/components/hook-form';
import DashedAccordion from 'src/components/expandable/DashedAccordion';

export default function MemberGeneralSection({
    age,
    division,
    isCreateView,
    control,
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
                        Información general
                    </Typography>

                    <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
                </Box>
            )}

            <Field.Text name="firstName" label="Nombres" />

            <Field.Text name="lastName" label="Apellidos" />

            <Field.DatePicker
                name="birthdate"
                label={`Fecha de nacimiento${age !== null ? ` (${age} años)` : ''
                    }`}
                format="DD/MM/YYYY"
                views={['year', 'month', 'day']}
            />


            <Field.Text
                name="memberDivision"
                label="División (cálculo automático según edad)"
                value={division || ''}
                disabled
            />

            <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => (
                    <Field.Phone
                        {...field}
                        label="Núm. Teléfono"
                        defaultCountry="DO"
                        inputProps={{ maxLength: 14 }}
                    />
                )}
            />

            <Field.Text name="email" label="Correo electrónico" />
        </>
    );
}