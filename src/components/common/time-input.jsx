import { useFormContext } from 'react-hook-form';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

export default function TimeInput({
    name = 'destMeetingTimes',
    label = 'Horario de reunión',
}) {
    const { setValue, watch } = useFormContext();

    const value = watch(name);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TimePicker
                label={label}
                value={value ? dayjs(value, 'HH:mm:ss') : null}
                onChange={(newValue) => {
                    const formatted = newValue
                        ? newValue.format('HH:mm:ss')
                        : null;

                    setValue(name, formatted, {
                        shouldValidate: true,
                        shouldDirty: true,
                    });
                }}
                ampm // ESTO ACTIVA AM/PM
                slotProps={{
                    textField: {
                        fullWidth: true,
                    },
                }}
            />
        </LocalizationProvider>
    );
}