import { useFormContext } from 'react-hook-form';

import { Field } from 'src/components/hook-form';

const DAYS = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábados',
    'Domingos',
];

export default function DaysSelect({
    name = 'day',
    label = 'Día',
    disabled = false,
}) {
    const { setValue, watch } = useFormContext();

    return (
        <Field.Autocomplete
            name={name}
            label={label}
            disabled={disabled}
            options={DAYS}
            value={watch(name) || null}
            onChange={(event, value) => {
                if (disabled) return;

                setValue(name, value || '', {
                    shouldValidate: true,
                    shouldDirty: true,
                });
            }}
            getOptionLabel={(option) => option || ''}
            isOptionEqualToValue={(option, value) => option === value}
        />
    );
}
