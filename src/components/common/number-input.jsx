import { useWatch, useFormContext } from 'react-hook-form';

import { Field } from 'src/components/hook-form';

export default function NumberInput({
    name = 'number',
    label = 'Número',
    maxLength = 3,
    minValue = null,
    maxValue = null,
    disabled = false,
    helperText = '',
}) {
    const { setValue, control } = useFormContext();
    // `useWatch` y no `watch`: `watch` del contexto repinta el formulario
    // ENTERO en cada tecla (miles de lineas en el de miembros) y escribir se
    // sentia lento. `useWatch` repinta solo este campo.
    const valorVigilado = useWatch({ control, name });

    const value = valorVigilado || '';

    return (
        <Field.Text
            name={name}
            label={label}
            value={value}
            disabled={disabled}
            helperText={
                helperText ||
                (minValue != null && maxValue != null
                    ? `Permitido: ${minValue}–${maxValue}`
                    : helperText)
            }
            inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
            }}
            slotProps={{
                htmlInput: {
                    maxLength,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    onInput: (event) => {
                        const limpio = event.currentTarget.value
                            .replace(/\D/g, '')
                            .replace(/^0+(?=\d)/, '')
                            .slice(0, maxLength);
                        if (event.currentTarget.value !== limpio) event.currentTarget.value = limpio;
                    },
                },
            }}
            onChange={(e) => {
                if (disabled) return;

                const val = e.target.value
                    .replace(/\D/g, '')
                    .replace(/^0+(?=\d)/, '')
                    .slice(0, maxLength);

                setValue(name, val, {
                    shouldValidate: true,
                    shouldDirty: true,
                });
            }}
        />
    );
}
