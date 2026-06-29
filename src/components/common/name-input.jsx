import { useFormContext } from 'react-hook-form';

import InputAdornment from '@mui/material/InputAdornment';

import { Field } from 'src/components/hook-form';

export default function NameInput({
    name = 'name',
    label = 'Nombre',
    maxLength = 60,
    allowNumbers = false,
    allowSpecialChars = false,
    allowDash = false,
    disabled = false,
    InputProps: externalInputProps = {},
}) {
    const { setValue, watch } = useFormContext();

    // 📌 Valor actual del input (para el contador)
    const currentValue = watch(name) || '';

    return (
        <Field.Text
            name={name}
            label={label}
            disabled={disabled}

            // 📌 Limita caracteres desde el input
            inputProps={{ maxLength }}

            // 📌 Contador dentro del input (lado derecho)
            InputProps={{
                ...externalInputProps, // 👈 IMPORTANTE

                endAdornment:
                    currentValue.length > 0 ? (
                        <InputAdornment position="end">
                            <span style={{ fontSize: 12, color: '#999' }}>
                                {currentValue.length}/{maxLength}
                            </span>
                        </InputAdornment>
                    ) : null,
            }}

            onChange={(e) => {
                if (disabled) return;

                let value = e.target.value;

                // ❌ Quitar números y símbolos
                let regex = 'A-Za-zÁÉÍÓÚáéíóúÑñ\\s';

                if (allowNumbers) regex += '0-9';
                if (allowDash) regex += '\\-';
                if (allowSpecialChars) regex += '#./';

                const pattern = new RegExp(`[^${regex}]`, 'g');

                value = value.replace(pattern, '');

                // ❌ No permitir espacios al inicio
                value = value.replace(/^\s+/, '');

                // ❌ Máximo 1 espacio entre palabras
                value = value.replace(/\s{2,}/g, ' ');

                // ❌ Límite de caracteres
                value = value.slice(0, maxLength);

                // ✅ Capitalizar cada palabra correctamente

                // ✅ Capitalizar palabras pero permitir minúsculas después de tildes
                value = value
                    .toLocaleLowerCase()
                    .split(' ')
                    .map((word) => {
                        if (!word) return word;

                        // 👉 palabras que deben ir en minúscula
                        const lowerWords = ['de'];

                        if (lowerWords.includes(word)) return word;

                        return word.charAt(0).toLocaleUpperCase() + word.slice(1);
                    })
                    .join(' ');

                // 👉 corregir "de" solo si está entre espacios
                value = value.replace(/\bDe\b/g, 'de');
                // 📌 Actualiza valor en react-hook-form
                // Solo valida si hay texto real
                setValue(name, value, {
                    shouldValidate: value.trim().length > 0,
                });
            }}
        />
    );
}
