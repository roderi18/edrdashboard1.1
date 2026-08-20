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
    // Punto y coma. Los nombres propios de entidades los llevan con normalidad
    // ("Iglesia Aposento Alto, Inc.", "Asambleas de Dios, INC."), y sin esto el
    // campo los borraba segun se escribian.
    allowPunctuation = false,
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
                if (allowPunctuation) regex += '.,';

                const pattern = new RegExp(`[^${regex}]`, 'g');

                value = value.replace(pattern, '');

                // ❌ No permitir espacios al inicio
                value = value.replace(/^\s+/, '');

                // ❌ Máximo 1 espacio entre palabras
                value = value.replace(/\s{2,}/g, ' ');

                // ❌ Límite de caracteres
                value = value.slice(0, maxLength);

                // ✅ Capitalizar cada palabra correctamente

                // Lo escrito ANTES de normalizar mayusculas. Se conserva para
                // poder devolver tal cual la letra que sigue a un punto: en
                // "A.D" o "Inc.SA" el usuario decide si va en mayuscula, y
                // forzarla a minuscula le corregia lo que acababa de teclear.
                // Los pasos anteriores ya no cambian la longitud, asi que las
                // posiciones de esta copia siguen valiendo.
                const escrito = value;

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

                // 👉 Tras un punto se respeta lo tecleado, mayuscula o minuscula.
                value = value.replace(
                    /\.(.)/g,
                    (coincidencia, caracter, posicion) => `.${escrito[posicion + 1] ?? caracter}`
                );
                // 📌 Actualiza valor en react-hook-form
                // shouldDirty marca el campo como modificado al instante (para
                // que el boton de guardar/enviar se habilite sin esperar al blur).
                // Solo valida si hay texto real.
                setValue(name, value, {
                    shouldDirty: true,
                    shouldValidate: value.trim().length > 0,
                });
            }}
        />
    );
}
