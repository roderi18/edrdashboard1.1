import dayjs from 'dayjs';
import { useWatch, useFormContext } from 'react-hook-form';

import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

export default function TimeInput({
    name = 'destMeetingTimes',
    label = 'Horario de reunión',
    disabled = false,
}) {
    const { setValue, control } = useFormContext();
    // `useWatch` y no `watch`: `watch` del contexto repinta el formulario
    // ENTERO en cada tecla (miles de lineas en el de miembros) y escribir se
    // sentia lento. `useWatch` repinta solo este campo.
    const valorVigilado = useWatch({ control, name });

    const value = valorVigilado;

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TimePicker
                label={label}
                value={value ? dayjs(value, 'HH:mm:ss') : null}
                disabled={disabled}
                onChange={(newValue) => {
                    if (disabled) return;

                    const formatted = newValue
                        ? newValue.format('HH:mm:ss')
                        : null;

                    setValue(name, formatted, {
                        shouldValidate: true,
                        shouldDirty: true,
                    });
                }}
                ampm
                slotProps={{
                    textField: {
                        fullWidth: true,
                    },
                }}
            />
        </LocalizationProvider>
    );
}
