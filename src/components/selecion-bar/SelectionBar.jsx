'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function SelectionBar({
    count = 0,
    label,
    color = 'success',
    actions,
    sx,
}) {
    if (!count) {
        return null;
    }

    return (
        <Box
            sx={{
                px: 2,
                py: 1.5,
                mb: 2,
                borderRadius: 1,
                bgcolor: `${color}.lighter`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                ...sx,
            }}
        >
            <Typography variant="subtitle2">
                {label ?? `${count} seleccionados`}
            </Typography>

            {actions && (
                <Stack direction="row" spacing={1}>
                    {actions}
                </Stack>
            )}
        </Box>
    );
}
