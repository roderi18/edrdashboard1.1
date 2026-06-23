'use client';

import { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

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

        value = value
            .toLocaleLowerCase()
            .split(' ')
            .map((word) => {
                if (!word) return word;

                const lowerWords = ['de'];

                if (lowerWords.includes(word)) return word;

                return word.charAt(0).toLocaleUpperCase() + word.slice(1);
            })
            .join(' ');

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
                            const formatted = formatValue(e.target.value);

                            setValue(name, formatted, {
                                shouldValidate: formatted.trim().length > 0,
                            });

                            setSuggestion(getSuggestion(formatted));
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