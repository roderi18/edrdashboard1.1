'use client';

import { useState, useRef, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';

export default function RestrictedText({
    label,
    value = '',
    onChange,
    maxLength = 10,
    allow = 'letters',
    message = 'Entrada no permitida.',
    readOnly = false,
    error = false,
    helperText = '',
    useTouched = false,
    blockedErrorText = '',
    ...other
}) {
    const [touched, setTouched] = useState(false);
    const [restrictionError, setRestrictionError] = useState(false);

    const fieldRef = useRef(null);

    const patterns = {
        letters: /[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g,
        numbers: /[^0-9]/g,
        phone: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/g,
        all: null,
    };

    const regex = patterns[allow] ?? null;

    const handleChange = (e) => {
        let val = e.target.value ?? '';

        if (regex && regex.test(val)) {
            setRestrictionError(true);
            val = val.replace(regex, '');
        } else {
            setRestrictionError(false);
        }

        onChange?.(val);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (fieldRef.current && !fieldRef.current.contains(event.target)) {
                setTouched(false);
                setRestrictionError(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showBlockedError = readOnly && touched;

    const showError = useTouched
        ? touched && (restrictionError || error || showBlockedError)
        : restrictionError || error || showBlockedError;

    const finalHelperText =
        restrictionError
            ? message
            : showBlockedError
                ? (blockedErrorText || helperText)
                : showError
                    ? helperText
                    : '';

    return (
        <div ref={fieldRef} style={{ display: 'contents' }}>
            <TextField
                {...other}
                label={label}
                value={value}
                onChange={handleChange}
                onFocus={() => setTouched(true)}
                onClick={() => setTouched(true)}
                error={showError}
                helperText={finalHelperText}
                InputProps={{
                    readOnly,
                    endAdornment:
                        value.length > 0 ? (
                            <InputAdornment position="end">
                                <Typography variant="caption" color="text.secondary">
                                    {value.length}/{maxLength}
                                </Typography>
                            </InputAdornment>
                        ) : null,
                }}
                inputProps={{
                    maxLength,
                }}
            />
        </div>
    );
}
