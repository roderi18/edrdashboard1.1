'use client';

import { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

import { colocarCursor, calcularPosicionCursor } from 'src/utils/input-caret';

export default function LocationSuggestInput({
    name,
    label,
    maxLength = 60,
    allowNumbers = false,
    allowSpecialChars = false,
    allowDash = false,
    disabled = false,
}) {
    const { control, setValue, watch } = useFormContext();

    const currentValue = watch(name) || '';

    const [options, setOptions] = useState([]);
    const [suggestion, setSuggestion] = useState('');

    useEffect(() => {
        const load = async () => {
            const prov = await import('src/data/provincias.json');
            const mun = await import('src/data/municipios.json');

            const list = [
                ...prov.default.map((p) => p.nombre),
                ...mun.default.map((m) => {
                    const provincia = prov.default.find(
                        (p) => p.provinciaId === m.provinciaId
                    );

                    return m.nombre;
                }),
            ];

            setOptions(list.filter(Boolean));
        };

        load();
    }, []);

    const getSuggestion = (input) => {
        if (!input) return '';

        const lower = input.toLowerCase();

        const match =
            options.find((opt) =>
                opt.toLowerCase().startsWith(lower)
            ) ||
            options.find((opt) =>
                opt.toLowerCase().includes(lower)
            ) ||
            '';

        return match.replace(/\s*\(.*?\)\s*/g, '');
    };

    const formatValue = (raw) => {
        let value = raw;

        let regex = 'A-Za-zÁÉÍÓÚáéíóúÑñ\\s';

        if (allowNumbers) regex += '0-9';
        if (allowDash) regex += '\\-';
        if (allowSpecialChars) regex += '#./()';

        const pattern = new RegExp(`[^${regex}]`, 'g');

        value = value.replace(pattern, '');

        value = value.replace(/^\s+/, '');
        value = value.replace(/\s{2,}/g, ' ');
        value = value.slice(0, maxLength);

        // Se capitaliza al principio, tras espacio y tambien tras "(" y ".".
        //
        // Antes solo se partia por espacios, asi que lo que venia detras de un
        // parentesis o de un punto se quedaba en minuscula: "(Zona Urbana)"
        // acababa como "(zona urbana)" y "A.D." como "A.d.". Se usa `\p{L}` con
        // la bandera unicode para que la letra acentuada tras un espacio tambien
        // se capitalice, y para que una tilde DENTRO de la palabra no cuente
        // como frontera.
        value = value
            .toLocaleLowerCase()
            .replace(
                /(^|[\s(.])(\p{L})/gu,
                (coincidencia, separador, letra) => separador + letra.toLocaleUpperCase()
            );

        value = value.replace(/\bDe\b/g, 'de');

        return value;
    };

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <Box sx={{ position: 'relative' }}>
                    {/* TEXTO FANTASMA */}
                    {suggestion &&
                        suggestion.toLowerCase() !== field.value?.toLowerCase() && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '14px',
                                    transform: 'translateY(-50%)',
                                    color: '#bbb',
                                    pointerEvents: 'none',
                                    fontSize: '16px',
                                    fontFamily: 'inherit',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {field.value}
                                <span style={{ color: '#ccc' }}>
                                    {suggestion.slice(field.value.length)}
                                </span>
                            </Box>
                        )}

                    <TextField
                        {...field}
                        label={label}
                        fullWidth
                        disabled={disabled}
                        error={!!error}
                        helperText={error?.message}
                        inputProps={{ maxLength }}

                        InputProps={{
                            endAdornment: (
                                <>
                                    {/* 👉 TAB hint */}
                                    {suggestion && (
                                        <InputAdornment position="end">
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: '#aaa',
                                                    border: '1px solid #ddd',
                                                    borderRadius: 4,
                                                    padding: '2px 6px',
                                                    marginRight: 6,
                                                    background: '#fafafa',
                                                }}
                                            >
                                                TAB
                                            </span>
                                        </InputAdornment>
                                    )}

                                    {/* 👉 contador */}
                                    {currentValue.length > 0 && (
                                        <InputAdornment position="end">
                                            <span style={{ fontSize: 12, color: '#999' }}>
                                                {currentValue.length}/{maxLength}
                                            </span>
                                        </InputAdornment>
                                    )}
                                </>
                            ),
                        }}

                        onChange={(e) => {
                            const input = e.target;
                            const escrito = input.value;
                            const formatted = formatValue(escrito);
                            // El texto se reescribe entero, asi que el cursor se
                            // recoloca a mano: sin esto saltaba al final y
                            // escribir dentro de un parentesis sacaba las letras
                            // fuera.
                            const posicionCursor = calcularPosicionCursor({
                                valor: escrito,
                                posicion: input.selectionStart,
                                formatear: formatValue,
                            });

                            setValue(name, formatted, {
                                shouldValidate: formatted.trim().length > 0,
                            });

                            setSuggestion(getSuggestion(formatted));
                            colocarCursor(input, posicionCursor);
                        }}

                        onKeyDown={(e) => {
                            if ((e.key === 'Tab' || e.key === 'Enter') && suggestion) {
                                e.preventDefault();
                                setValue(name, suggestion);
                                setSuggestion('');
                            }
                        }}
                    />
                </Box>
            )}
        />
    );
}