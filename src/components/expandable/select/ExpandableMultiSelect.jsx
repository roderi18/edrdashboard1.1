'use client';

import { useRef, useState, useEffect } from 'react';

import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';

const defaultFormatLabel = (value) => {
    if (!value) return '';
    return value
        .toString()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
};

export function ExpandableMultiSelect({
    label,
    value = [],
    onChange,
    isActive,
    onOpen,
    onClose,
    options = [],
    getOptionValue,
    getOptionLabel,
    getOptionDisabled,
    width = 200,
    compact = false,
    icon = 'ic:round-filter-list',
}) {
    const [expanded, setExpanded] = useState(false);
    const inputRef = useRef(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [open, setOpen] = useState(false);
    const safeValue = Array.isArray(value) ? value : [];

    const hasValue = Array.isArray(value) && value.length > 0;
    useEffect(() => {
        if (isMobile && (!value || value.length === 0)) {
            setOpen(false);
            setExpanded(false);
        }
    }, [value, isMobile]);

    // Focus automático al expandir
    useEffect(() => {
        if (expanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [expanded]);

    const resolveValue = (option) => {
        if (getOptionValue) return getOptionValue(option);
        if (typeof option === 'object') return option.value;
        return option;
    };

    const resolveLabel = (option) => {
        if (getOptionLabel) return getOptionLabel(option);
        if (typeof option === 'object')
            return option.label ?? defaultFormatLabel(option.value);
        return defaultFormatLabel(option);
    };

    const resolveDisabled = (option) => {
        if (getOptionDisabled) return getOptionDisabled(option);
        if (typeof option === 'object') return Boolean(option.disabled);
        return false;
    };

    const handleClickAway = () => {
        if (!value || value.length === 0) {
            setExpanded(false);
        }
    };

    return (
        <TextField
            select
            multiple
            inputRef={inputRef}
            label={isMobile ? (expanded || hasValue ? label : '') : label}
            value={value ?? []}
            onChange={onChange}
            onMouseDown={(e) => {
                if (!isMobile) return;
                onOpen?.(); // Cierra Search inmediatamente
                if (!expanded) {
                    e.preventDefault();
                    e.stopPropagation();

                    setExpanded(true);

                    setTimeout(() => {
                        setOpen(true);
                    }, 300);
                }
            }}

            onBlur={() => {
                if (isMobile && !hasValue) {
                    setExpanded(false);
                }
            }}

            SelectProps={{
                multiple: true,

                ...(isMobile && {
                    open,
                    onOpen: () => {
                        setOpen(true);
                        onOpen?.();
                    },
                    onClose: () => {
                        setOpen(false);
                        if (!value?.length) {
                            setExpanded(false);
                        }
                        onClose?.();
                    },
                }),

                IconComponent: isMobile
                    ? (expanded ? undefined : () => null)
                    : undefined,

                renderValue: (selected) =>
                    selected
                        .map((val) =>
                            resolveLabel(
                                options.find((opt) => resolveValue(opt) === val)
                            )
                        )
                        .join(', '),

                MenuProps: {
                    PaperProps: {
                        sx: {
                            width: isMobile && compact ? width : undefined,
                        },
                    },
                },
            }}

            sx={{
                width: isMobile && compact ? (expanded ? width : 54) : width,
                transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',

                '& .MuiOutlinedInput-root': {
                    height: 54,
                },

                '& .MuiSelect-select': {
                    paddingRight: '0px !important',
                },

                ...(compact && !expanded && {
                    '& .MuiSelect-select': {
                        opacity: 0,
                        paddingRight: '0px !important',
                    },
                    '& .MuiInputLabel-root': {
                        opacity: 0,
                    },
                }),
            }}

            InputProps={
                isMobile
                    ? {
                        startAdornment: (
                            <InputAdornment position="start">
                                <Iconify
                                    icon={icon}
                                    sx={{
                                        color: hasValue ? 'primary.main' : 'text.disabled',
                                    }}
                                />
                            </InputAdornment>
                        ),
                    }
                    : undefined
            }

        >
            {options.map((option) => {
                const optionValue = resolveValue(option);
                const optionDisabled = resolveDisabled(option);

                return (
                    <MenuItem key={optionValue} value={optionValue} disabled={optionDisabled}>
                        <Checkbox checked={value.includes(optionValue)} disabled={optionDisabled} />
                        {resolveLabel(option)}
                    </MenuItem>
                );
            })}
        </TextField>
    );
}
