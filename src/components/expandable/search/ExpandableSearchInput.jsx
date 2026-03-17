'use client';

import { useState, useRef, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { Iconify } from 'src/components/iconify';

export function ExpandableSearchInput({
    value,
    onChange,
    placeholder,
    width,
    compact,
    activeInput,
    onOpen,
    onClose,
}) {
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!value && !focused) {
            setOpen(false);
            onClose?.();
        }
    }, [value, focused]);

    // 🔥 Auto focus cuando se abre
    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    useEffect(() => {
        if (activeInput !== 'search') {
            setOpen(false);
        }
    }, [activeInput]);

    if (!compact) {
        return (
            <TextField
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                sx={{ width }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <Iconify icon="eva:search-fill" />
                            </InputAdornment>
                        ),
                    },
                }}
            />
        );
    }

    return (
        <TextField
            inputRef={inputRef}
            value={value}
            onChange={onChange}
            placeholder={open ? placeholder : ''}
            onClick={() => {
                setOpen(true);
                onOpen?.();
            }}
            onFocus={() => setFocused(true)}

            onBlur={() => {
                setFocused(false);
                if (!value) {
                    setOpen(false);
                    onClose?.();
                }
            }}

            sx={{
                width: open ? width : 54,
                transition: open
                    ? 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)'   // abrir
                    : 'width 100ms cubic-bezier(0.4, 0, 1, 1)',    // cerrar (más rápido y más seco)
                cursor: 'text',
                overflow: 'hidden',

                '& .MuiOutlinedInput-root': {
                    height: 54,
                },
            }}

            slotProps={{
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <Iconify
                                icon="eva:search-fill"
                                sx={{ color: 'text.disabled' }}
                            />
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}
