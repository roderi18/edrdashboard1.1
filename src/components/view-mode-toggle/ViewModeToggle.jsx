'use client';

import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useTheme, useMediaQuery } from '@mui/material';
import { Iconify } from 'src/components/iconify';
import { useEffect, useState } from 'react';
export function ViewModeToggle({ value, onChange, storageKey }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [hydrated, setHydrated] = useState(false);

    // Resolver modo inicial
    useEffect(() => {
        setHydrated(true);

        if (isMobile) {
            onChange?.('grid');
            return;
        }

        const saved = localStorage.getItem(storageKey);
        if (saved) {
            onChange?.(saved);
        }
    }, [isMobile, storageKey, onChange]);

    // Guardar cambios
    useEffect(() => {
        if (!hydrated) return;

        if (!isMobile && value) {
            localStorage.setItem(storageKey, value);
        }
    }, [value, isMobile, storageKey, hydrated]);

    const handleChange = (event, newValue) => {
        if (!newValue) return;
        onChange?.(newValue);
    };

    if (!hydrated) return null;

    return (
        <ToggleButtonGroup
            size="small"
            value={value}
            exclusive
            onChange={handleChange}
            sx={{
                '& .MuiToggleButton-root': {
                    minWidth: 44,
                    height: 44,
                    padding: 0,
                },
            }}
        >
            <ToggleButton value="panel">
                <Iconify icon="solar:list-bold" />
            </ToggleButton>

            <ToggleButton value="grid">
                <Iconify icon="mingcute:dot-grid-fill" />
            </ToggleButton>
        </ToggleButtonGroup>
    );
}