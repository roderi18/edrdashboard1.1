import { useWatch, useFormContext } from 'react-hook-form';

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
    const { setValue, control } = useFormContext();
    // `useWatch` y no `watch`: `watch` del contexto repinta el formulario
    // ENTERO en cada tecla (miles de lineas en el de miembros) y escribir se
    // sentia lento. `useWatch` repinta solo este campo.
    const valorVigilado = useWatch({ control, name });

    return (
        <Field.Autocomplete
            name={name}
            label={label}
            disabled={disabled}
            options={DAYS}
            value={valorVigilado || null}
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
