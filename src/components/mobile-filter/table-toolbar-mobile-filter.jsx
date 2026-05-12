'use client';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

export function TableToolbarMobileFilter({
    filtersConfig = [],
    hasActiveFilters = false,
}) {
    const popover = usePopover();
    const [searchValues, setSearchValues] = useState({});
    return (
        <>
            <Box
                sx={(theme) => {
                    const selected = popover.open;

                    return {
                        width: 54,
                        height: 54,
                        borderRadius: 1,
                        border: `1px solid ${theme.vars.palette.divider}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',

                        bgcolor: selected
                            ? theme.vars.palette.action.selected
                            : 'transparent',

                        transition: 'all 0.2s ease',
                    };
                }}
            >
                <IconButton
                    onClick={popover.onOpen}
                    sx={(theme) => ({
                        width: '85%',
                        height: '85%',
                        borderRadius: 1,
                        transition: 'all 0.2s ease',

                        '&:hover': {
                            bgcolor: theme.vars.palette.action.hover,
                        },
                    })}
                >
                    <Iconify icon="ic:round-filter-list" />
                </IconButton>
            </Box>

            <CustomPopover
                open={popover.open}
                anchorEl={popover.anchorEl}
                onClose={popover.onClose}
                slotProps={{ arrow: { placement: 'top-right' } }}
            >
                <Box
                    sx={{
                        p: 2,
                        width: 260, //tamaño desplegable horizon
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                    }}
                >
                    {filtersConfig.map((filter) => (
                        <FormControl key={filter.key} fullWidth>
                            <InputLabel id={`${filter.key}-label`}>
                                {filter.label}
                            </InputLabel>
                            <Select
                                labelId={`${filter.key}-label`}
                                label={filter.label}
                                multiple
                                value={filter.value}
                                onChange={(event) => {
                                    const newValue = event.target.value;

                                    const cleanValue = Array.isArray(newValue)
                                        ? newValue.filter((v) => v !== '' && v !== undefined && v !== null)
                                        : [];

                                    filter.onChange?.({
                                        ...event,
                                        target: {
                                            ...event.target,
                                            value: cleanValue,
                                        },
                                    });
                                }}
                                renderValue={(selected) => {
                                    if (!selected || selected.length === 0) return '';

                                    return selected
                                        .map((val) => {
                                            const found = filter.options.find(
                                                (opt) => (opt.value ?? opt) === val
                                            );
                                            return found?.label ?? found ?? val;
                                        })
                                        .join(', ');
                                }}

                                // Evita que MUI intente bloquear el scroll del body (eso causa reposicionamientos raros en mobile).
                                MenuProps={{
                                    disableAutoFocusItem: true,
                                    disableScrollLock: true,
                                    anchorOrigin: {
                                        vertical: 'bottom',
                                        horizontal: 'left',
                                    },
                                    transformOrigin: {
                                        vertical: 'top',
                                        horizontal: 'left',
                                    },
                                    slotProps: {
                                        paper: {
                                            sx: {
                                                maxHeight: '40vh', //tamaño del desplegable vertical
                                                overflow: 'auto',
                                            },
                                        },
                                    },
                                }}
                            >

                                {/* 🔍 Search */}
                                <Box
                                    sx={{
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1,
                                        bgcolor: 'background.paper',
                                        px: 1,
                                        pt: 1,
                                        pb: 1,
                                        borderBottom: (theme) => `1px solid ${theme.vars.palette.divider}`,
                                    }}
                                >
                                    <TextField
                                        size="small"
                                        autoFocus
                                        placeholder="Buscar..."
                                        fullWidth
                                        value={searchValues[filter.key] || ''}
                                        onChange={(e) =>
                                            setSearchValues((prev) => ({
                                                ...prev,
                                                [filter.key]: e.target.value,
                                            }))
                                        }
                                        onKeyDown={(e) => e.stopPropagation()}
                                        InputProps={{
                                            endAdornment: searchValues[filter.key] ? (
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        setSearchValues((prev) => ({
                                                            ...prev,
                                                            [filter.key]: '',
                                                        }))
                                                    }
                                                >
                                                    <Iconify icon="eva:close-fill" width={18} />
                                                </IconButton>
                                            ) : null,
                                        }}
                                    />
                                </Box>

                                {/* 🔽 Opciones filtradas */}
                                {filter.options
                                    .filter((option) => {
                                        const label = (option.label ?? option).toString().toLowerCase();
                                        const search = (searchValues[filter.key] || '').toLowerCase();
                                        return label.includes(search);
                                    })
                                    .map((option, index) => (
                                        <MenuItem
                                            key={option.value ?? `${option}-${index}`}
                                            value={option.value ?? option}
                                        >
                                            <Checkbox
                                                size="small"
                                                checked={filter.value.includes(option.value ?? option)}
                                            />
                                            {option.label ?? option}
                                        </MenuItem>
                                    ))}
                            </Select>
                        </FormControl>
                    ))}
                </Box>
            </CustomPopover>
        </>
    );
}
