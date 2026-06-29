import dayjs from 'dayjs';
import { useFormContext } from 'react-hook-form';

import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

export default function TimeInput({
    name = 'destMeetingTimes',
    label = 'Horario de reunión',
    disabled = false,
}) {
    const { setValue, watch } = useFormContext();

    const value = watch(name);

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
