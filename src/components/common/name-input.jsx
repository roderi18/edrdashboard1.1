import { useFormContext } from 'react-hook-form';
import { Field } from 'src/components/hook-form';
import InputAdornment from '@mui/material/InputAdornment';

export default function NameInput({
    name = 'name',
    label = 'Nombre',
    maxLength = 60,
    allowNumbers = false,
    allowSpecialChars = false,
    InputProps: externalInputProps = {},
}) {
    const { setValue, watch } = useFormContext();

    // 📌 Valor actual del input (para el contador)
    const currentValue = watch(name) || '';

    return (
        <Field.Text
            name={name}
            label={label}

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
                let value = e.target.value;

                // ❌ Quitar números y símbolos
                value = allowNumbers
                    ? value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]/g, '') // permite números
                    : value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, ''); // solo letras

                // Permitir caracteres
                if (allowSpecialChars) {
                    value = allowNumbers
                        ? value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s#\-./]/g, '')
                        : value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s#\-./]/g, '');
                } else {
                    value = allowNumbers
                        ? value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]/g, '')
                        : value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
                }

                // ❌ No permitir espacios al inicio
                value = value.replace(/^\s+/, '');

                // ❌ Máximo 1 espacio entre palabras
                value = value.replace(/\s{2,}/g, ' ');

                // ❌ Límite de caracteres
                value = value.slice(0, maxLength);

                // ✅ Capitalizar cada palabra correctamente
                // (respeta tildes y no rompe palabras)
                if (!allowSpecialChars) {
                    value = value
                        .toLowerCase()
                        .split(' ')
                        .map((word) =>
                            word.charAt(0).toLocaleUpperCase() + word.slice(1)
                        )
                        .join(' ');
                }

                // 📌 Actualiza valor en react-hook-form
                // Solo valida si hay texto real
                setValue(name, value, {
                    shouldValidate: value.trim().length > 0,
                });
            }}
        />
    );
}